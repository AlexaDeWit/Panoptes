import { focusSelectionControl } from '../canvas/selection-control.js';
import { useSnap } from '../canvas/snap.js';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useCommandSurface } from '../commands/binding.js';
import {
  commandById,
  diagramExportCommand,
  runCommand,
  type Command,
  type CommandId,
} from '../commands/registry.js';
import {
  hostPlatform,
  keyShortcutsAttribute,
  spellShortcuts,
} from '../commands/shortcuts.js';
import {
  elementById,
  canRedo,
  canUndo,
  isDirty,
  needsCloseGuard,
  renameable,
  selectedElement,
} from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { LiveRegion } from '../ui/live-region.js';
import {
  colourModes,
  isColourMode,
  type ColourMode,
} from '../theme-preference.js';
import type { FileSession } from './file-commands.js';
import styles from './menu.module.css';
import {
  formatFiles,
  formatOf,
  formatsFrom,
  nameOf,
  reportHeadlines,
  reportLines,
} from './session.js';

type MenuItemProps = {
  readonly chord?: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly keepOpen?: boolean;
  readonly keyShortcuts?: string;
  readonly onChoose: () => void;
};

function MenuItem({
  chord,
  children,
  disabled,
  keepOpen,
  keyShortcuts,
  onChoose,
}: MenuItemProps) {
  return (
    <DropdownMenu.Item
      aria-keyshortcuts={keyShortcuts}
      className={styles.item}
      disabled={disabled}
      onSelect={(event) => {
        if (keepOpen === true) {
          event.preventDefault();
        }
        onChoose();
      }}
    >
      <span>{children}</span>
      {chord !== undefined && (
        <span aria-hidden="true" className={styles.chord}>
          {chord}
        </span>
      )}
    </DropdownMenu.Item>
  );
}

type MenuCommandProps = {
  readonly command: CommandId;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
};

function MenuCommand({ command, children, disabled }: MenuCommandProps) {
  return (
    <RegisteredMenuCommand disabled={disabled} entry={commandById(command)}>
      {children}
    </RegisteredMenuCommand>
  );
}

type RegisteredMenuCommandProps = {
  readonly entry: Command;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
};

function RegisteredMenuCommand({
  entry,
  children,
  disabled,
}: RegisteredMenuCommandProps) {
  const surface = useCommandSurface();
  const hasShortcut = entry.shortcuts.length > 0;

  return (
    <MenuItem
      chord={
        hasShortcut ? spellShortcuts(entry.shortcuts, hostPlatform) : undefined
      }
      disabled={disabled}
      keyShortcuts={
        hasShortcut
          ? keyShortcutsAttribute(entry.shortcuts, hostPlatform)
          : undefined
      }
      onChoose={() => {
        runCommand(entry, surface);
      }}
    >
      {children ?? entry.label}
    </MenuItem>
  );
}

type UnsavedChangesCommandProps = {
  readonly asking: boolean;
  readonly cancel: () => void;
  readonly command: CommandId;
  readonly dirty: boolean;
  readonly proceed: () => void;
  readonly question: string;
};

function UnsavedChangesCommand({
  asking,
  cancel,
  command,
  dirty,
  proceed,
  question,
}: UnsavedChangesCommandProps) {
  const entry = commandById(command);
  const surface = useCommandSurface();

  return (
    <>
      <MenuItem
        chord={
          asking ? undefined : spellShortcuts(entry.shortcuts, hostPlatform)
        }
        keepOpen={dirty && !asking}
        keyShortcuts={
          asking
            ? undefined
            : keyShortcutsAttribute(entry.shortcuts, hostPlatform)
        }
        onChoose={
          asking
            ? proceed
            : () => {
                runCommand(entry, surface);
              }
        }
      >
        {asking ? question : entry.label}
      </MenuItem>
      {asking && <MenuItem onChoose={cancel}>Cancel</MenuItem>}
    </>
  );
}

function ProjectLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild className={styles.item}>
      <a href={href} rel="noopener noreferrer" target="_blank">
        <span>{children}</span>
        <ExternalLinkIcon aria-hidden="true" className={styles.externalLink} />
      </a>
    </DropdownMenu.Item>
  );
}

/** The session the items run their commands through. */
export type StudioMenuProps = {
  readonly session: FileSession;
  readonly colourMode?: ColourMode;
  readonly onColourModeChange?: (mode: ColourMode) => void;
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
};

/** The non-modal file, edit and project menu, with reports beside its trigger. */
export function StudioMenu({
  session,
  colourMode,
  onColourModeChange,
  triggerRef,
}: StudioMenuProps) {
  const snapping = useSnap();
  const file = useModelStore((state) => state.file);
  const failure = useModelStore((state) => state.lastFailure);
  const dirty = useModelStore(isDirty);
  const guarded = useModelStore(needsCloseGuard);
  const undoable = useModelStore(canUndo);
  const redoable = useModelStore(canRedo);
  const nothing = useModelStore((state) => state.selection.length === 0);
  const renamable = useModelStore(renameable);
  const selected = useModelStore(selectedElement);
  const selectedFlow = useModelStore((state) => {
    const id = selectedElement(state);
    return id !== undefined && elementById(state, id)?.kind === 'flow';
  });
  const [open, setOpen] = useState(false);
  const selectedColourMode = colourMode ?? 'system';

  useCloseGuard(guarded);
  useAsking(session.opening, dirty, setOpen, session.cancelOpen);
  useAsking(session.closing, dirty, setOpen, session.cancelClose);
  useChoosing(session.choosing, setOpen);

  const {
    asksFormat,
    attachPicker,
    cancelOpen,
    cancelChoice,
    cancelClose,
    chooseFormat,
    choosing,
    closing,
    commands,
    confirmOpen,
    confirmClose,
    dismissReport,
    dismissExportNotice,
    exportNotice,
    opening,
    receive,
    report,
  } = session;
  const saveAsCommand = commandById('save-as');
  const askingOpen = opening && dirty;
  const askingClose = closing && dirty;
  const format = formatOf(file);

  return (
    <div className={styles.menu}>
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            cancelOpen();
            cancelClose();
            cancelChoice();
          }
        }}
        open={open}
      >
        <DropdownMenu.Trigger
          aria-label={dirty ? 'Menu, unsaved changes' : 'Menu'}
          className={styles.burger}
          ref={triggerRef}
        >
          <span aria-hidden="true">☰</span>
          {dirty && <span aria-hidden="true" className={styles.dot} />}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          onCloseAutoFocus={(event) => {
            if (focusSelectionControl()) {
              event.preventDefault();
            }
          }}
          align="start"
          className={styles.panel}
          sideOffset={6}
        >
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              File
            </DropdownMenu.Label>
            <UnsavedChangesCommand
              asking={askingOpen}
              cancel={cancelOpen}
              command="open"
              dirty={dirty}
              proceed={confirmOpen}
              question="Discard changes and open"
            />
            <MenuCommand command="save" />
            <MenuItem
              chord={
                choosing
                  ? undefined
                  : spellShortcuts(saveAsCommand.shortcuts, hostPlatform)
              }
              keepOpen={asksFormat && !choosing}
              keyShortcuts={
                choosing
                  ? undefined
                  : keyShortcutsAttribute(saveAsCommand.shortcuts, hostPlatform)
              }
              onChoose={
                choosing
                  ? () => {
                      chooseFormat(format);
                    }
                  : () => {
                      commands.saveAs();
                    }
              }
            >
              {choosing
                ? `Save as ${formatFiles[format].label}`
                : saveAsCommand.label}
            </MenuItem>
            {choosing &&
              formatsFrom(format)
                .slice(1)
                .map((option) => (
                  <MenuItem
                    key={option}
                    onChoose={() => {
                      chooseFormat(option);
                    }}
                  >
                    Save as {formatFiles[option].label}
                  </MenuItem>
                ))}
            <ExportMenu />
            <UnsavedChangesCommand
              asking={askingClose}
              cancel={cancelClose}
              command="close-file"
              dirty={dirty}
              proceed={confirmClose}
              question="Discard changes and create new model"
            />
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger
              aria-label={`Appearance ${selectedColourMode}`}
              className={styles.item}
            >
              <span>Appearance</span>
              <span aria-hidden="true" className={styles.chord}>
                {selectedColourMode[0].toUpperCase() +
                  selectedColourMode.slice(1)}
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent className={styles.panel}>
              <DropdownMenu.RadioGroup
                aria-label="Appearance"
                onValueChange={(value) => {
                  if (isColourMode(value)) {
                    onColourModeChange?.(value);
                  }
                }}
                value={selectedColourMode}
              >
                {colourModes.map((mode) => (
                  <DropdownMenu.RadioItem
                    className={styles.item}
                    key={mode}
                    value={mode}
                  >
                    <span aria-hidden="true" className={styles.radioMark}>
                      {selectedColourMode === mode ? '●' : '○'}
                    </span>
                    <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              Edit
            </DropdownMenu.Label>
            <MenuCommand command="undo" disabled={!undoable} />
            <MenuCommand command="redo" disabled={!redoable} />
            <MenuCommand command="copy" disabled={nothing} />
            <MenuCommand command="cut" disabled={nothing} />
            <MenuCommand command="paste" />
            <MenuCommand command="duplicate" disabled={nothing} />
            <MenuCommand command="edit-geometry" disabled={nothing} />
            <MenuCommand command="reconnect-source" disabled={!selectedFlow} />
            <MenuCommand command="reconnect-target" disabled={!selectedFlow} />
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className={styles.item}>
                Arrange
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className={styles.panel}>
                {(
                  [
                    'align-left',
                    'align-centre',
                    'align-right',
                    'align-top',
                    'align-middle',
                    'align-bottom',
                    'distribute-horizontal',
                    'distribute-vertical',
                  ] as const
                ).map((command) => (
                  <MenuCommand
                    command={command}
                    disabled={nothing}
                    key={command}
                  />
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <MenuCommand command="rename" disabled={!renamable} />
            <MenuCommand
              command="focus-threats"
              disabled={selected === undefined}
            />
            <MenuCommand command="delete" disabled={nothing} />
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              View
            </DropdownMenu.Label>
            <MenuCommand command="reset-zoom" />
            <MenuCommand command="fit-selection" disabled={nothing} />
            <MenuCommand command="snap-to-grid">
              {commandById('snap-to-grid').label}: {snapping ? 'on' : 'off'}
            </MenuCommand>
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              Project
            </DropdownMenu.Label>
            <ProjectLink href="https://github.com/AlexaDeWit/Saerskriven">
              View source on GitHub
            </ProjectLink>
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              Help
            </DropdownMenu.Label>
            <MenuCommand command="shortcut-reference" />
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group className={styles.about}>
            <p className={styles.state} data-testid="file-state">
              {nameOf(file)}, {formatFiles[format].label},{' '}
              {dirty ? 'unsaved changes' : 'no unsaved changes'}
            </p>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <input
        className={styles.input}
        data-testid="file-input"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          void receive(chosen);
        }}
        ref={attachPicker}
        type="file"
      />
      <FailureNotice failure={failure} />
      <LiveRegion
        className={styles.report}
        label="File reports"
        testId="loss-report"
      >
        {report !== undefined && (
          <>
            <p className={styles.headline}>
              {reportHeadlines[report.occasion]}
            </p>
            <ul className={styles.lines}>
              {reportLines(report.divergences).map((line, index) => (
                <li key={`${String(index)} ${line}`}>{line}</li>
              ))}
            </ul>
            <button
              className={styles.dismiss}
              onClick={dismissReport}
              type="button"
            >
              Dismiss report
            </button>
          </>
        )}
        {exportNotice !== undefined && (
          <div data-testid="export-report">
            <p className={styles.headline}>{exportNotice.headline}</p>
            {exportNotice.details.length > 0 && (
              <ul className={styles.lines}>
                {exportNotice.details.map((line, index) => (
                  <li key={`${String(index)} ${line}`}>{line}</li>
                ))}
              </ul>
            )}
            <button
              className={styles.dismiss}
              onClick={dismissExportNotice}
              type="button"
            >
              Dismiss export report
            </button>
          </div>
        )}
      </LiveRegion>
    </div>
  );
}

function ExportMenu() {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const several = diagrams.length > 1;

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={styles.item}>
        <span>Export</span>
        <span aria-hidden="true" className={styles.chord}>
          ›
        </span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent className={styles.panel} sideOffset={6}>
        {diagrams.length === 0 && (
          <MenuCommand command="export-diagram" disabled />
        )}
        {diagrams.map((diagram) => (
          <RegisteredMenuCommand
            entry={diagramExportCommand(diagram, several)}
            key={diagram.id}
          />
        ))}
        <MenuCommand command="export-register" />
        <MenuCommand command="export-typst" />
        <MenuCommand command="export-pdf" />
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}

function useAsking(
  closing: boolean,
  dirty: boolean,
  show: (open: boolean) => void,
  cancel: () => void,
): void {
  useEffect(() => {
    if (!closing) {
      return;
    }
    if (dirty) {
      show(true);
      return;
    }
    cancel();
  }, [cancel, closing, dirty, show]);
}

function useChoosing(choosing: boolean, show: (open: boolean) => void): void {
  useEffect(() => {
    if (choosing) {
      show(true);
    }
  }, [choosing, show]);
}

function useCloseGuard(guarded: boolean): void {
  useEffect(() => {
    if (!guarded) {
      return undefined;
    }
    const guard = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    globalThis.addEventListener('beforeunload', guard);
    return () => {
      globalThis.removeEventListener('beforeunload', guard);
    };
  }, [guarded]);
}
