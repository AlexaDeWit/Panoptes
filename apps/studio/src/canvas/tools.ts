import { useSyncExternalStore } from 'react';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
import { resetAnnouncements } from './announcements.js';
import { elementTools, type ElementTool } from './elements.js';

/** Every mode the toolbox offers. */
export const tools = ['select', ...elementTools, 'hand'] as const;

/** One mode the toolbox offers. */
export type Tool = (typeof tools)[number];

/** The active tool, its lock, its draft revision and transition count. */
export type ToolState = {
  readonly active: Tool;
  readonly locked: boolean;
  readonly revision: number;
  readonly transition: number;
};

const atRest: ToolState = {
  active: 'select',
  locked: false,
  revision: 0,
  transition: 0,
};

let current = atRest;

let beforeHeldHand: ToolState | undefined;

const listeners = new Set<() => void>();

/** Selects one toolbox mode. Selecting Select also clears the selection. */
export function selectTool(tool: Tool): void {
  beforeHeldHand = undefined;
  moveTo({ active: tool, locked: false });
  if (tool === 'select') {
    dispatch(Action.Select({ elementIds: [] }));
  }
}

/** Locks an element tool for repeated placement. */
export function lockTool(tool: ElementTool): void {
  beforeHeldHand = undefined;
  moveTo({ active: tool, locked: true });
}

/** Returns an unlocked element tool to Select after one placement. */
export function finishPlacement(): void {
  if (current.locked || !isElementTool(current.active)) {
    return;
  }
  moveTo({ active: 'select', locked: false });
}

/** Holds Hand for as long as Space is down, retaining the prior tool. */
export function holdHandTool(): void {
  if (beforeHeldHand !== undefined) {
    return;
  }
  beforeHeldHand = current;
  moveTo({ active: 'hand', locked: false }, current.revision);
}

/** Restores the tool that was active before Space was held. */
export function releaseHandTool(): void {
  if (beforeHeldHand === undefined) {
    return;
  }
  const restored = beforeHeldHand;
  beforeHeldHand = undefined;
  moveTo(
    { active: restored.active, locked: restored.locked },
    restored.revision,
  );
}

/** Whether `tool` places an element. */
export function isElementTool(tool: Tool): tool is ElementTool {
  return (elementTools as readonly Tool[]).includes(tool);
}

/** Forgets the active and held modes, which is how a spec starts from rest. */
export function resetTools(): void {
  beforeHeldHand = undefined;
  moveTo(atRest);
}

/** What the toolbox is showing, for a spec and for {@link useTool}. */
export function currentTool(): ToolState {
  return current;
}

/** Subscribes a component to toolbox mode changes. */
export function useTool(): ToolState {
  return useSyncExternalStore(subscribe, currentTool, currentTool);
}

function moveTo(
  next: Pick<ToolState, 'active' | 'locked'>,
  revision = current.revision + 1,
): void {
  if (next.active === current.active && next.locked === current.locked) {
    return;
  }
  current = { ...next, revision, transition: current.transition + 1 };
  resetAnnouncements();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
