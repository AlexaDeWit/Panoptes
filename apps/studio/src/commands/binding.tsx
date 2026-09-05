import { createContext, useContext, useEffect, type ReactNode } from 'react';
import {
  commandFor,
  runCommand,
  type Command,
  type CommandSurface,
} from './registry.js';
import { hostPlatform, type Platform } from './shortcuts.js';

const nothing = (): void => undefined;

/**
 * The surface a command reaches while nothing that answers for it is
 * mounted. It is the context's default, so a control rendered on its own in
 * a spec still runs the commands the store answers for and the rest do
 * nothing rather than failing.
 */
export const unmountedSurface: CommandSurface = {
  files: { open: nothing, save: nothing, saveAs: nothing },
  view: { zoomIn: nothing, zoomOut: nothing, fitToView: nothing },
};

/**
 * Who a key press belongs to. An overlay that is open is handling the same
 * keys the studio binds, Escape and every letter among them, so nothing is
 * taken out from under it. A text field is where a person is writing, so
 * only the commands the registry exempts fire there. Everything else is the
 * page, where every shortcut is the studio's.
 */
export const keyboardOwners = ['page', 'text-field', 'overlay'] as const;

/** Who the key press in front of the studio belongs to. */
export type KeyboardOwner = (typeof keyboardOwners)[number];

const overlaySelector =
  '[role="combobox"], [role="listbox"], [role="menu"], [role="dialog"]';

const textFieldSelector =
  'input, textarea, [contenteditable]:not([contenteditable="false"])';

/** Which of {@link keyboardOwners} holds the keyboard while `target` has it. */
export function keyboardOwner(target: EventTarget | null): KeyboardOwner {
  if (!(target instanceof Element)) {
    return 'page';
  }
  if (target.closest(overlaySelector) !== null) {
    return 'overlay';
  }
  return target.closest(textFieldSelector) === null ? 'page' : 'text-field';
}

/**
 * The command a key press runs, and nothing at all where it runs none: a
 * press a control has already acted on, one an open overlay owns, one no
 * chord matches, and one aimed at a command the field it was typed in
 * suppresses.
 *
 * A press the canvas has already answered arrives here with its default
 * prevented, which is how one Delete removes one element while the canvas
 * still binds that key itself.
 */
export function commandForKey(
  event: KeyboardEvent,
  platform: Platform,
): Command | undefined {
  const owner = keyboardOwner(event.target);
  if (event.defaultPrevented || owner === 'overlay') {
    return undefined;
  }
  const command = commandFor(event, platform);
  if (
    command === undefined ||
    (owner === 'text-field' && !command.inTextFields)
  ) {
    return undefined;
  }
  return command;
}

/**
 * Binds every registered chord, for the whole page rather than for the
 * control that holds focus, which is what makes a command reachable wherever
 * a person is. A chord the registry claims is taken from the browser whether
 * or not the command has a dispatch yet, so a shortcut the studio advertises
 * never does something else instead.
 */
export function useCommandKeys(surface: CommandSurface): void {
  useEffect(() => {
    const pressed = (event: KeyboardEvent): void => {
      const command = commandForKey(event, hostPlatform);
      if (command === undefined) {
        return;
      }
      event.preventDefault();
      runCommand(command, surface);
    };
    document.addEventListener('keydown', pressed);
    return () => {
      document.removeEventListener('keydown', pressed);
    };
  }, [surface]);
}

const surfaceContext = createContext<CommandSurface>(unmountedSurface);

/** The surface and the tree the commands bound to it are pressed from. */
export type CommandSurfaceProviderProps = {
  readonly surface: CommandSurface;
  readonly children: ReactNode;
};

/**
 * Where the registry meets a running studio: it installs the chords and
 * offers the same surface to every control below it, so one command has one
 * dispatch whether it was pressed or clicked.
 */
export function CommandSurfaceProvider({
  surface,
  children,
}: CommandSurfaceProviderProps) {
  useCommandKeys(surface);
  return (
    <surfaceContext.Provider value={surface}>
      {children}
    </surfaceContext.Provider>
  );
}

/** The surface a control runs its command against. */
export function useCommandSurface(): CommandSurface {
  return useContext(surfaceContext);
}
