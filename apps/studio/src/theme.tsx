import { tokenStylesheet } from '@saerskriven/canvas';
import { useEffect, useSyncExternalStore } from 'react';
import {
  readColourMode,
  writeColourMode,
  type ColourMode,
} from './theme-preference.js';

let selectedMode: ColourMode | undefined;
const subscribers = new Set<() => void>();

const currentMode = (): ColourMode =>
  (selectedMode ??= readColourMode(readStorage()));

const readStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

const applyColourMode = (mode: ColourMode): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (mode === 'system') {
    delete root.dataset.pnColourMode;
  } else {
    root.dataset.pnColourMode = mode;
  }
};

applyColourMode(currentMode());

/**
 * The design tokens, as the custom properties every CSS module in the studio
 * reads. They are injected here rather than written in `styles.css` because
 * the values are the canvas package's: the chrome and the diagram inside it
 * are coloured from one table, and a stylesheet here would be a copy of it
 * that nothing keeps in step.
 *
 * The sheet carries the light table and the dark one, the second under
 * `prefers-color-scheme: dark`, so the whole of the mode switch is these
 * properties resolving to other values and no component below asks which
 * mode it is in.
 */
export function DesignTokens() {
  const [mode] = useColourMode();

  useEffect(() => {
    applyColourMode(mode);
  }, [mode]);

  return <style data-mode={mode}>{tokenStylesheet}</style>;
}

export function useColourMode(): readonly [
  ColourMode,
  (mode: ColourMode) => void,
] {
  const mode = useSyncExternalStore(
    (subscribe) => {
      subscribers.add(subscribe);
      return () => {
        subscribers.delete(subscribe);
      };
    },
    currentMode,
    (): ColourMode => 'system',
  );

  const choose = (next: ColourMode): void => {
    selectedMode = next;
    writeColourMode(readStorage(), next);
    subscribers.forEach((subscriber) => {
      subscriber();
    });
  };

  return [mode, choose];
}
