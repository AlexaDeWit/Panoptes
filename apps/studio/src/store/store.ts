import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Action } from './actions.js';
import { reduce } from './reducer.js';
import { initialState, placeholderModel, type State } from './state.js';

/**
 * The studio's one store. It is a vanilla store rather than a React one, so
 * a spec drives it without rendering anything and {@link useModelStore} is
 * the only part that needs a component.
 */
export const modelStore = createStore(() => initialState(placeholderModel));

/**
 * Applies `action` through {@link reduce}, the one way the state moves outside
 * a spec's reset. The result replaces the state whole rather than merging into
 * it, so an arm that drops a field shows up as a missing field instead of
 * being papered over by the old value.
 */
export function dispatch(action: Action): void {
  modelStore.setState((state) => reduce(state, action), true);
}

/**
 * Subscribes a component to one slice of the state. It re-renders when
 * `select` returns something new and stays put while the rest of the state
 * moves, so nothing has to be invalidated by hand. A selector that builds a
 * fresh array or object returns something new every time, so wrap it in
 * zustand's `useShallow` at the call site or the component re-renders on
 * every dispatch.
 */
export function useModelStore<Selected>(
  select: (state: State) => Selected,
): Selected {
  return useStore(modelStore, select);
}
