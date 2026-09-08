import { Cross1Icon } from '@radix-ui/react-icons';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  contextualGroups,
  contextualShortcuts,
  pressesContextualShortcut,
} from './contextual-shortcuts.js';
import { commandGroups, commands, type ReferenceCommands } from './registry.js';
import {
  hostPlatform,
  spellShortcuts,
  type Chord,
  type Platform,
} from './shortcuts.js';
import styles from './shortcut-reference.module.css';

type ReferenceEntry = {
  readonly id: string;
  readonly label: string;
  readonly shortcuts: readonly Chord[];
  readonly when: string;
};

/** State and commands used to mount the shortcut reference. */
export type ShortcutReferenceControl = {
  readonly close: () => void;
  readonly commands: ReferenceCommands;
  readonly menuTrigger: RefObject<HTMLButtonElement | null>;
  readonly open: boolean;
};

/** Controls the panel and returns focus to the control that opened it. */
export function useShortcutReference(): ShortcutReferenceControl {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    queueMicrotask(() => {
      if (opener.current?.isConnected === true) {
        opener.current.focus();
      } else {
        menuTrigger.current?.focus();
      }
    });
  }, []);

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }
    const active = document.activeElement;
    opener.current =
      active instanceof HTMLElement && active !== document.body
        ? active.closest('[role="menu"]') === null
          ? active
          : menuTrigger.current
        : menuTrigger.current;
    setOpen(true);
  }, [close, open]);

  const referenceCommands = useMemo<ReferenceCommands>(
    () => ({ toggle }),
    [toggle],
  );
  return { close, commands: referenceCommands, menuTrigger, open };
}

/** The non-modal reference for every command and contextual shortcut. */
export function ShortcutReference({
  onClose,
  platform = hostPlatform,
}: {
  readonly onClose: () => void;
  readonly platform?: Platform;
}) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const closeOnEscape = (event: KeyboardEvent<HTMLElement>): void => {
    if (
      !pressesContextualShortcut('close-shortcut-reference', event, platform)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <section
      aria-labelledby="shortcut-reference-heading"
      className={styles.panel}
      data-testid="shortcut-reference"
      onKeyDownCapture={closeOnEscape}
    >
      <header className={styles.header}>
        <h2
          className={styles.heading}
          id="shortcut-reference-heading"
          ref={heading}
          tabIndex={-1}
        >
          Keyboard shortcuts
        </h2>
        <button
          aria-label="Close keyboard shortcuts"
          className={styles.close}
          onClick={onClose}
          type="button"
        >
          <Cross1Icon aria-hidden="true" />
        </button>
      </header>
      <p className={styles.introduction}>
        Shortcuts run only in the contexts shown. Commands typed into a text
        field stay with that field unless their context says otherwise.
      </p>
      {commandGroups.map((group) => (
        <ReferenceSection
          entries={commands.filter((entry) => entry.group === group)}
          key={group}
          platform={platform}
          title={group}
          type="command"
        />
      ))}
      {contextualGroups.map((group) => (
        <ReferenceSection
          entries={contextualShortcuts.filter((entry) => entry.group === group)}
          key={group}
          platform={platform}
          title={group}
          type="contextual"
        />
      ))}
    </section>
  );
}

function ReferenceSection({
  entries,
  platform,
  title,
  type,
}: {
  readonly entries: readonly ReferenceEntry[];
  readonly platform: Platform;
  readonly title: string;
  readonly type: 'command' | 'contextual';
}) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupHeading}>{title}</h3>
      <ul className={styles.entries}>
        {entries.map((entry) => (
          <li
            className={styles.entry}
            data-command-id={type === 'command' ? entry.id : undefined}
            data-contextual-id={type === 'contextual' ? entry.id : undefined}
            key={entry.id}
          >
            <span className={styles.label}>{entry.label}</span>
            <kbd className={styles.keys}>
              {entry.shortcuts.length === 0
                ? 'No shortcut'
                : spellShortcuts(entry.shortcuts, platform)}
            </kbd>
            <span className={styles.when}>{entry.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
