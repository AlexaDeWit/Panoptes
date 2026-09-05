import { useId, type ReactNode } from 'react';
import { useCommandSurface } from './binding.js';
import { commandById, runCommand, type CommandId } from './registry.js';
import {
  hostPlatform,
  keyShortcutsAttribute,
  spellShortcuts,
} from './shortcuts.js';
import styles from './command-button.module.css';

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
  const surface = useCommandSurface();
  const description = useId();
  const entry = commandById(command);
  const spelled = spellShortcuts(entry.shortcuts, hostPlatform);

  return (
    <>
      <button
        aria-describedby={description}
        aria-keyshortcuts={keyShortcutsAttribute(entry.shortcuts, hostPlatform)}
        className={className}
        disabled={disabled}
        onClick={() => {
          runCommand(entry, surface);
        }}
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
