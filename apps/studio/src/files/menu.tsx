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
import { canRedo, canUndo, isDirty } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { LiveRegion } from '../ui/live-region.js';
import type { FileSession } from './file-commands.js';
import styles from './menu.module.css';
import {
  formatLabels,
  formatOf,
  nameOf,
  otherFormat,
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

/** The session the items run their commands through. */
export type StudioMenuProps = { readonly session: FileSession };

/**
 * The studio's one menu, over the top left of the canvas: the file commands,
 * the edit commands, the file the model lives in and what the last crossing
 * of the file boundary cost.
 *
 * Every item is a registered command ([the
 * commands](../commands/README.md)), so an item and its chord run one
 * dispatch and the chord each item shows is read from the registry rather
 * than written here. The chord is drawn beside the label and hidden from
 * assistive technology, which reads the binding off `aria-keyshortcuts`
 * instead: inside the name, Save would read "Save Ctrl+S".
 *
 * The menu is not modal, so the canvas stays live behind it and a press
 * outside it lands where it was aimed. Choosing an item puts the menu away,
 * which is also what uncovers the report a save leaves under the button.
 *
 * The loss report and the failure notice are the menu's chrome rather than
 * its items, drawn under the button and over the canvas. Both are the shared
 * live region ([the controls](../ui/README.md)), and neither can go inside
 * the menu: a menu owns items and groups of them, and an audit reads a live
 * region there as a menu that has lost its shape. Standing outside it is also
 * what lets each announce as it arrives rather than only once the menu is
 * opened, which is what a save through a chord needs. The report says what one
 * file crossing cost and stands until it is dismissed, a save starts, an open
 * lands, or the file is closed.
 *
 * Closing asks before it drops work that is in no file, and asks in the menu
 * rather than in a dialog: the item itself becomes the question, with the
 * answer that keeps the file beside it. It is the one item that holds the
 * menu open, and it holds it where it stood, so a person who reached it by
 * keyboard is still on it and the second press is the answer. The chord asks
 * the same question with the menu shut, which is what opens the menu.
 *
 * The fallback picker's input is outside the menu as well, and hidden: only a
 * component can hold a file input, and the Open command is the one way to it.
 */
export function StudioMenu({ session }: StudioMenuProps) {
  const file = useModelStore((state) => state.file);
  const failure = useModelStore((state) => state.lastFailure);
  const dirty = useModelStore(isDirty);
  const undoable = useModelStore(canUndo);
  const redoable = useModelStore(canRedo);
  const [open, setOpen] = useState(false);

  useCloseGuard(dirty);
  useAsking(session.closing, setOpen);

  const {
    attachPicker,
    cancelClose,
    closing,
    commands,
    confirmClose,
    dismissReport,
    receive,
    report,
  } = session;
  const closeCommand = commandById('close-file');
  const format = formatOf(file);
  const alternative = otherFormat(format);

  return (
    <div className={styles.menu}>
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            cancelClose();
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
            <MenuCommand command="save-as">
              Save as {formatLabels[alternative]}
            </MenuCommand>
            <MenuItem
              chord={
                closing
                  ? undefined
                  : spellShortcuts(closeCommand.shortcuts, hostPlatform)
              }
              keepOpen={dirty && !closing}
              keyShortcuts={
                closing
                  ? undefined
                  : keyShortcutsAttribute(closeCommand.shortcuts, hostPlatform)
              }
              onChoose={
                closing
                  ? confirmClose
                  : () => {
                      commands.close();
                    }
              }
            >
              {closing ? 'Discard the changes and close' : closeCommand.label}
            </MenuItem>
            {closing && (
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
          </DropdownMenu.Group>
          <DropdownMenu.Separator className={styles.rule} />
          <DropdownMenu.Group className={styles.about}>
            <p className={styles.state} data-testid="file-state">
              {nameOf(file)}, {formatLabels[format]},{' '}
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

function useAsking(closing: boolean, show: (open: boolean) => void): void {
  useEffect(() => {
    if (closing) {
      show(true);
    }
  }, [closing, show]);
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
