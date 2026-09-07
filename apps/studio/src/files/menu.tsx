import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from 'radix-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useCommandSurface } from '../commands/binding.js';
import {
  commandById,
  runCommand,
  type CommandId,
} from '../commands/registry.js';
import {
  hostPlatform,
  keyShortcutsAttribute,
  spellShortcuts,
} from '../commands/shortcuts.js';
import { canRedo, canUndo, isDirty, renameable } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { LiveRegion } from '../ui/live-region.js';
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
  const surface = useCommandSurface();
  const entry = commandById(command);

  return (
    <MenuItem
      chord={spellShortcuts(entry.shortcuts, hostPlatform)}
      disabled={disabled}
      keyShortcuts={keyShortcutsAttribute(entry.shortcuts, hostPlatform)}
      onChoose={() => {
        runCommand(entry, surface);
      }}
    >
      {children ?? entry.label}
    </MenuItem>
  );
}

function SourceLink() {
  return (
    <DropdownMenu.Item asChild className={styles.item}>
      <a
        href="https://github.com/AlexaDeWit/Saerskriven"
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>View source on GitHub</span>
        <ExternalLinkIcon aria-hidden="true" className={styles.externalLink} />
      </a>
    </DropdownMenu.Item>
  );
}

/** The session the items run their commands through. */
export type StudioMenuProps = { readonly session: FileSession };

/** The non-modal file, edit and project menu, with reports beside its trigger. */
export function StudioMenu({ session }: StudioMenuProps) {
  const file = useModelStore((state) => state.file);
  const failure = useModelStore((state) => state.lastFailure);
  const dirty = useModelStore(isDirty);
  const undoable = useModelStore(canUndo);
  const redoable = useModelStore(canRedo);
  const nothing = useModelStore((state) => state.selection === undefined);
  const renamable = useModelStore(renameable);
  const [open, setOpen] = useState(false);

  useCloseGuard(dirty);
  useAsking(session.closing, dirty, setOpen, session.cancelClose);
  useChoosing(session.choosing, setOpen);

  const {
    asksFormat,
    attachPicker,
    cancelChoice,
    cancelClose,
    chooseFormat,
    choosing,
    closing,
    commands,
    confirmClose,
    dismissReport,
    dismissExportNotice,
    exportNotice,
    exports,
    receive,
    report,
  } = session;
  const closeCommand = commandById('close-file');
  const saveAsCommand = commandById('save-as');
  const asking = closing && dirty;
  const format = formatOf(file);

  return (
    <div className={styles.menu}>
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            cancelClose();
            cancelChoice();
          }
        }}
        open={open}
      >
        <DropdownMenu.Trigger
          aria-label={dirty ? 'Menu, unsaved changes' : 'Menu'}
          className={styles.burger}
        >
          <span aria-hidden="true">☰</span>
          {dirty && <span aria-hidden="true" className={styles.dot} />}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align="start"
          className={styles.panel}
          sideOffset={6}
        >
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              File
            </DropdownMenu.Label>
            <MenuCommand command="open" />
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
            <ExportMenu commands={exports} />
            <MenuItem
              chord={
                asking
                  ? undefined
                  : spellShortcuts(closeCommand.shortcuts, hostPlatform)
              }
              keepOpen={dirty && !asking}
              keyShortcuts={
                asking
                  ? undefined
                  : keyShortcutsAttribute(closeCommand.shortcuts, hostPlatform)
              }
              onChoose={
                asking
                  ? confirmClose
                  : () => {
                      commands.close();
                    }
              }
            >
              {asking ? 'Discard the changes and close' : closeCommand.label}
            </MenuItem>
            {asking && (
              <MenuItem onChoose={cancelClose}>Keep the file open</MenuItem>
            )}
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              Edit
            </DropdownMenu.Label>
            <MenuCommand command="undo" disabled={!undoable} />
            <MenuCommand command="redo" disabled={!redoable} />
            <MenuCommand command="rename" disabled={!renamable} />
            <MenuCommand command="delete" disabled={nothing} />
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group>
            <DropdownMenu.Label className={styles.heading}>
              Project
            </DropdownMenu.Label>
            <SourceLink />
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
              Dismiss the report
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
              Dismiss the export report
            </button>
          </div>
        )}
      </LiveRegion>
    </div>
  );
}

function ExportMenu({
  commands,
}: {
  readonly commands: FileSession['exports'];
}) {
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
          <MenuItem disabled onChoose={() => undefined}>
            Diagram as SVG
          </MenuItem>
        )}
        {diagrams.map((diagram) => (
          <MenuItem
            key={diagram.id}
            onChoose={() => {
              commands.diagram(diagram.id);
            }}
          >
            {several ? `Diagram as SVG: ${diagram.title}` : 'Diagram as SVG'}
          </MenuItem>
        ))}
        <MenuItem
          onChoose={() => {
            commands.register();
          }}
        >
          Register as Markdown
        </MenuItem>
        <MenuItem
          onChoose={() => {
            commands.typst();
          }}
        >
          Model as Typst
        </MenuItem>
        <MenuItem
          onChoose={() => {
            commands.pdf();
          }}
        >
          Model as PDF
        </MenuItem>
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

function useCloseGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    const guard = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    globalThis.addEventListener('beforeunload', guard);
    return () => {
      globalThis.removeEventListener('beforeunload', guard);
    };
  }, [dirty]);
}
