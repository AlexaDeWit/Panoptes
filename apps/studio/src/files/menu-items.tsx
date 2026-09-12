import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { useCommandSurface } from '../commands/binding.js';
import {
  commandById,
  runCommand,
  type Command,
  type CommandId,
} from '../commands/registry.js';
import {
  hostPlatform,
  keyShortcutsAttribute,
  spellShortcuts,
} from '../commands/shortcuts.js';
import styles from './menu.module.css';

type MenuItemProps = {
  readonly chord?: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly keepOpen?: boolean;
  readonly keyShortcuts?: string;
  readonly onChoose: () => void;
};

/** One item of the menu, its chord drawn beside it and declared for assistive technology. */
export function MenuItem({
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

/** A registered command as a menu item, run through the mounted surface. */
export function MenuCommand({ command, children, disabled }: MenuCommandProps) {
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

/** A command bound at render time, such as one export item per diagram. */
export function RegisteredMenuCommand({
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
