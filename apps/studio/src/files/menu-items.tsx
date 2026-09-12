import { ChevronRightIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from 'radix-ui';
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
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

/** The element a {@link Submenu} lines its start edge up with: row one of the chrome card, on screen at every width. */
export const SubmenuEdge = createContext<RefObject<HTMLElement | null>>({
  current: null,
});

type SubmenuOffsets = {
  readonly align: number;
  readonly side: number;
};

const besideTrigger: SubmenuOffsets = { align: 0, side: 0 };

const offsetsFrom = (edge: Element, trigger: Element): SubmenuOffsets => {
  const row = trigger.getBoundingClientRect();
  return {
    align: row.height,
    side: edge.getBoundingClientRect().left - row.right,
  };
};

type SubmenuProps = {
  readonly children: ReactNode;
  readonly label?: string;
  readonly trigger: ReactNode;
};

/**
 * A second level of the menu. It opens under its own row at the start edge of
 * {@link SubmenuEdge}, measured as it opens, and never over the row: a pointer
 * that opened it by hovering would otherwise press whatever item landed under
 * it. A submenu taller than the room below scrolls rather than moving up.
 */
export function Submenu({ children, label, trigger }: SubmenuProps) {
  const edge = useContext(SubmenuEdge);
  const row = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState(besideTrigger);

  return (
    <DropdownMenu.Sub
      onOpenChange={(open) => {
        if (open && edge.current !== null && row.current !== null) {
          setOffsets(offsetsFrom(edge.current, row.current));
        }
      }}
    >
      <DropdownMenu.SubTrigger
        aria-label={label}
        className={styles.item}
        ref={row}
      >
        {trigger}
        <ChevronRightIcon aria-hidden="true" className={styles.chord} />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent
        alignOffset={offsets.align}
        avoidCollisions={false}
        className={styles.panel}
        sideOffset={offsets.side}
        tabIndex={0}
      >
        {children}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
}
