import { Tooltip } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import { useCommandSurface } from './binding.js';
import {
  commandById,
  runCommand,
  type Command,
  type CommandId,
} from './registry.js';
import {
  hostPlatform,
  keyShortcutsAttribute,
  spellShortcuts,
} from './shortcuts.js';
import styles from './command-button.module.css';

const tooltipDelay = 200;

const tooltipOffset = 6;

/**
 * Which command the control runs, and the words it runs it under. `children`
 * is for a control that says more than the command is called, a save that
 * names the format among them; leaving it out takes the registry's own
 * label, which is what a menu or a toolbox wants.
 */
export type CommandButtonProps = {
  readonly command: CommandId;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
};

/**
 * Which command the control runs, and the glyph that stands for it.
 * `children` is the icon, and is required: an icon control that draws nothing
 * shows nothing.
 */
export type IconCommandButtonProps = {
  readonly command: CommandId;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly children: ReactNode;
};

/**
 * A control that runs one registered command, showing the shortcut that runs
 * the same one. The chord reaches a person three ways: as the tooltip, as
 * `aria-keyshortcuts`, which is the attribute that names a control's key
 * binding, and as the control's accessible description, so a screen reader
 * says it without the pointer a tooltip needs.
 */
export function CommandButton({
  command,
  className,
  disabled,
  children,
}: CommandButtonProps) {
  const description = useId();
  const { entry, spelled, keyShortcuts, press } = usePressed(command);

  return (
    <>
      <button
        aria-describedby={description}
        aria-keyshortcuts={keyShortcuts}
        className={className}
        disabled={disabled}
        onClick={press}
        title={spelled}
        type="button"
      >
        {children ?? entry.label}
      </button>
      <span className={styles.shortcut} id={description}>
        Shortcut: {spelled}
      </span>
    </>
  );
}

/**
 * The same control drawn as an icon alone, which is what the floating chrome
 * carries. The registry's label is the accessible name, the glyph having
 * none, and the label with its chord is what the tooltip says. The tooltip is
 * Radix's rather than the `title` attribute the worded control carries,
 * because a control with no words on it has to say what it is to a keyboard
 * as well as to a pointer and `title` is shown on hover alone. It renders
 * where it stands rather than through a portal, so it stays inside the
 * landmark the control sits in ([the studio's UI](../ui/README.md)), and it
 * leaves with the pointer that opened it: it holds nothing to reach into, so
 * Radix's grace area for reaching would only leave it standing over the
 * canvas.
 */
export function IconCommandButton({
  command,
  className,
  disabled,
  children,
}: IconCommandButtonProps) {
  const { entry, spelled, keyShortcuts, press } = usePressed(command);

  return (
    <Tooltip.Provider delayDuration={tooltipDelay} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-keyshortcuts={keyShortcuts}
          aria-label={entry.label}
          className={className}
          disabled={disabled}
          onClick={press}
          type="button"
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Content className={styles.tooltip} sideOffset={tooltipOffset}>
          {entry.label} <span className={styles.chord}>{spelled}</span>
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

type Pressed = {
  readonly entry: Command;
  readonly spelled: string;
  readonly keyShortcuts: string;
  readonly press: () => void;
};

function usePressed(command: CommandId): Pressed {
  const surface = useCommandSurface();
  const entry = commandById(command);

  return {
    entry,
    spelled: spellShortcuts(entry.shortcuts, hostPlatform),
    keyShortcuts: keyShortcutsAttribute(entry.shortcuts, hostPlatform),
    press: () => {
      runCommand(entry, surface);
    },
  };
}
