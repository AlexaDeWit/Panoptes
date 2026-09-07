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

/** Applies the selected colour mode to the document root. */
export function Theme() {
  const [mode] = useColourMode();

  useEffect(() => {
    applyColourMode(mode);
  }, [mode]);

  return null;
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
