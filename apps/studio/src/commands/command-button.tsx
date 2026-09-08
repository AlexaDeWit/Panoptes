import { Tooltip } from 'radix-ui';
import { useId, type MouseEventHandler, type ReactNode } from 'react';
import { VisuallyHidden } from '../ui/visually-hidden.js';
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
  readonly description?: string;
  readonly command: CommandId;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly onDoubleClick?: MouseEventHandler<HTMLButtonElement>;
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
      <VisuallyHidden id={description}>Shortcut: {spelled}</VisuallyHidden>
    </>
  );
}

/** An icon control with its registered name, shortcut tooltip, and optional state description. */
export function IconCommandButton({
  description,
  command,
  className,
  disabled,
  pressed,
  onDoubleClick,
  children,
}: IconCommandButtonProps) {
  const descriptionId = useId();
  const { entry, spelled, keyShortcuts, press } = usePressed(command);

  return (
    <Tooltip.Provider delayDuration={tooltipDelay} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger
          {...(description === undefined
            ? {}
            : { 'aria-describedby': descriptionId })}
          aria-keyshortcuts={keyShortcuts}
          aria-label={entry.label}
          aria-pressed={pressed}
          className={className}
          disabled={disabled}
          onClick={press}
          onDoubleClick={onDoubleClick}
          type="button"
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Content className={styles.tooltip} sideOffset={tooltipOffset}>
          {entry.label} <span className={styles.chord}>{spelled}</span>
        </Tooltip.Content>
        {description !== undefined && (
          <VisuallyHidden id={descriptionId}>
            {description} Shortcut: {spelled}
          </VisuallyHidden>
        )}
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
