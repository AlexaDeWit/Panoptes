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
        <svg
          aria-hidden="true"
          className={styles.externalLink}
          viewBox="0 0 16 16"
        >
          <path d="M9.5 2.5h4v4M13.5 2.5l-6 6M12.5 9v3.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1H7" />
        </svg>
      </a>
    </DropdownMenu.Item>
  );
}

/** The session the items run their commands through. */
export type StudioMenuProps = { readonly session: FileSession };

/** The file, edit and project menu over the canvas. */
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
        label="Loss report"
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
      </LiveRegion>
    </div>
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
