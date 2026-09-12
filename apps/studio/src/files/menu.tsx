import { focusSelectionControl } from '../canvas/selection-control.js';
import { useSnap } from '../canvas/snap.js';
import { ExternalLinkIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { useCommandSurface } from '../commands/binding.js';
import {
  commandById,
  diagramExportCommand,
  runCommand,
  type CommandId,
} from '../commands/registry.js';
import {
  hostPlatform,
  keyShortcutsAttribute,
  spellShortcuts,
} from '../commands/shortcuts.js';
import {
  canRedo,
  canUndo,
  isDirty,
  needsCloseGuard,
  renameable,
} from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { LiveRegion } from '../ui/live-region.js';
import { colourModes, type ColourMode } from '../theme-preference.js';
import { DiagramSwitcher } from './diagram-switcher.js';
import { MenuCommand, MenuItem, RegisteredMenuCommand } from './menu-items.js';
import type { FileSession } from './file-commands.js';
import styles from './menu.module.css';
import { RadioChoices } from './radio-choices.js';
import {
  formatFiles,
  formatOf,
  formatsFrom,
  nameOf,
  reportHeadlines,
  reportLines,
  type LossReport,
} from './session.js';

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
          asking || entry.shortcuts.length === 0
            ? undefined
            : spellShortcuts(entry.shortcuts, hostPlatform)
        }
        keepOpen={dirty && !asking}
        keyShortcuts={
          asking || entry.shortcuts.length === 0
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

function SubmenuTrigger({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label?: string;
}) {
  return (
    <DropdownMenu.SubTrigger aria-label={label} className={styles.item}>
      {children}
      <ChevronRightIcon aria-hidden="true" className={styles.chord} />
    </DropdownMenu.SubTrigger>
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

/** The non-modal file, edit and project menu, as row one of the chrome card. */
export function StudioMenu({
  session,
  colourMode,
  onColourModeChange,
  triggerRef,
}: StudioMenuProps) {
  const dirty = useModelStore(isDirty);
  const guarded = useModelStore(needsCloseGuard);
  const [open, setOpen] = useState(false);
  const selectedColourMode = colourMode ?? 'system';

  useCloseGuard(guarded);
  useAsking(session.opening, dirty, setOpen, session.cancelOpen);
  useAsking(session.importing, dirty, setOpen, session.cancelImport);
  useAsking(session.closing, dirty, setOpen, session.cancelClose);
  useChoosing(session.choosing, setOpen);

  const { attachPicker, cancelOpen, cancelChoice, cancelClose, receive } =
    session;

  return (
    <div className={styles.bar}>
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            cancelOpen();
            session.cancelImport();
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
          tabIndex={0}
          onCloseAutoFocus={(event) => {
            if (focusSelectionControl()) {
              event.preventDefault();
            }
          }}
          align="start"
          className={styles.panel}
          sideOffset={6}
        >
          <FileMenu dirty={dirty} session={session} />
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Sub>
            <SubmenuTrigger label={`Appearance ${selectedColourMode}`}>
              <span>Appearance</span>
              <span aria-hidden="true" className={styles.chord}>
                {selectedColourMode[0].toUpperCase() +
                  selectedColourMode.slice(1)}
              </span>
            </SubmenuTrigger>
            <DropdownMenu.SubContent tabIndex={0} className={styles.panel}>
              <RadioChoices
                choices={colourModes.map((mode) => ({
                  value: mode,
                  label: mode[0].toUpperCase() + mode.slice(1),
                }))}
                label="Appearance"
                onChoose={(mode) => {
                  onColourModeChange?.(mode);
                }}
                value={selectedColourMode}
              />
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator className={styles.rule} />
          <EditMenu />
          <DropdownMenu.Separator className={styles.rule} />
          <ViewMenu />
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
          <FileState dirty={dirty} />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <DiagramSwitcher />
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
    </div>
  );
}

/**
 * The last refused read and the report of the last crossing of the file
 * boundary, which hang under the chrome card rather than sitting in it: both
 * are empty until something has been refused or has cost the model a key, and
 * both can run to several lines.
 */
export function FileReports({ session }: { readonly session: FileSession }) {
  const failure = useModelStore((state) => state.lastFailure);
  const { dismissExportNotice, dismissReport, exportNotice, report } = session;

  return (
    <>
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
            <ReportDetails report={report} />
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
    </>
  );
}

function FileState({ dirty }: { readonly dirty: boolean }) {
  const file = useModelStore((state) => state.file);

  return (
    <DropdownMenu.Group className={styles.about}>
      <p className={styles.state} data-testid="file-state">
        {nameOf(file)}, {formatFiles[formatOf(file)].label},{' '}
        {dirty ? 'unsaved changes' : 'no unsaved changes'}
      </p>
    </DropdownMenu.Group>
  );
}

function FileMenu({
  dirty,
  session,
}: {
  readonly dirty: boolean;
  readonly session: FileSession;
}) {
  const file = useModelStore((state) => state.file);
  const {
    asksFormat,
    cancelOpen,
    cancelClose,
    chooseFormat,
    choosing,
    closing,
    commands,
    confirmOpen,
    confirmClose,
    opening,
  } = session;
  const saveAsCommand = commandById('save-as');
  const format = formatOf(file);
  const askingOpen = opening && dirty;
  const askingClose = closing && dirty;

  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.heading}>File</DropdownMenu.Label>
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
      <UnsavedChangesCommand
        asking={session.importing && dirty}
        cancel={session.cancelImport}
        command="import"
        dirty={dirty}
        proceed={session.confirmImport}
        question="Discard changes and import"
      />
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
  );
}

function EditMenu() {
  const undoable = useModelStore(canUndo);
  const redoable = useModelStore(canRedo);
  const nothing = useModelStore((state) => state.selection.length === 0);
  const renamable = useModelStore(renameable);

  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.heading}>Edit</DropdownMenu.Label>
      <MenuCommand command="undo" disabled={!undoable} />
      <MenuCommand command="redo" disabled={!redoable} />
      <DropdownMenu.Sub>
        <SubmenuTrigger>Arrange</SubmenuTrigger>
        <DropdownMenu.SubContent tabIndex={0} className={styles.panel}>
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
            <MenuCommand command={command} disabled={nothing} key={command} />
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
      <MenuCommand command="rename" disabled={!renamable} />
    </DropdownMenu.Group>
  );
}

function ViewMenu() {
  const snapping = useSnap();
  const nothing = useModelStore((state) => state.selection.length === 0);

  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.heading}>View</DropdownMenu.Label>
      <MenuCommand command="fit-selection" disabled={nothing} />
      <MenuCommand command="snap-to-grid">
        {commandById('snap-to-grid').label}: {snapping ? 'on' : 'off'}
      </MenuCommand>
    </DropdownMenu.Group>
  );
}

function ReportDetails({ report }: { readonly report: LossReport }) {
  const lines = (
    <ul className={styles.lines}>
      {reportLines(report.divergences, report.occasion).map((line, index) => (
        <li key={`${String(index)} ${line}`}>{line}</li>
      ))}
    </ul>
  );
  return report.occasion === 'import' ? (
    <details>
      <summary>{report.divergences.length} conversion details</summary>
      {lines}
    </details>
  ) : (
    lines
  );
}

function ExportMenu() {
  const diagrams = useModelStore((state) => state.present.diagrams);
  const several = diagrams.length > 1;

  return (
    <DropdownMenu.Sub>
      <SubmenuTrigger>
        <span>Export</span>
      </SubmenuTrigger>
      <DropdownMenu.SubContent
        tabIndex={0}
        className={styles.panel}
        sideOffset={6}
      >
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
