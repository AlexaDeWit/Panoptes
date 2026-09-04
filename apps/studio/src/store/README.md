# The studio's model store

One store holds the whole studio: the model on screen, the undo and redo
stacks, the selection, the file lifecycle, and the last operation the model
refused. `dispatch(action)` is the only way any of it moves, and it applies
one pure `reduce(state, action)`. Views read through selectors and nothing
else.

Zustand hosts it because React Flow 12 is a zustand store itself, so the
canvas and the studio share one subscription model, and a component
re-renders only when the slice its selector returns changes. The reducer
shape is the constraint the host had to satisfy rather than something the
host provides: `State` and a bounded `Action` union, exhaustively matched,
with history as two stacks of immutable snapshots. Redux Toolkit is the same
shape with more ceremony and Immer over operations that are already pure,
`useReducer` with context re-renders every consumer on every dispatch, and
jotai and valtio offer no reducer shape and no immutable snapshot to push
onto a stack.

## The shape

- `state.ts` holds `State`, the `FileLifecycle` enum, the state a model starts
  in, and the placeholder model the studio opens on until issue #37 can open a
  file. The stacks hold whole models: the model's operations return new models
  sharing everything they did not change, so a snapshot is cheap.
- `actions.ts` is the `Action` union, an Effect `Data.taggedEnum`. Nine tags
  carry a `@panoptes/model` operation and its arguments; the rest are undo,
  redo, selection, and the two ends of the file lifecycle.
- `reducer.ts` is the one pure function. It is total: an operation the model
  refuses leaves the present and both stacks alone and records the failure in
  `lastFailure`, so no dispatch fails and no view handles an error. A
  successful edit pushes the old present onto `past` and clears `future`.
- `store.ts` creates the vanilla store, and `useModelStore(selector)` is the
  React half.
- `selectors.ts` derives what views show. Unsaved work is `present !== saved`
  by identity, so undoing back to the saved point clears it with no
  bookkeeping.

Selection and the file lifecycle stay out of the undo stacks, so an undo
moves the model and leaves the user where they were.

## What a later slice does

- A new mutation is a new action tag, a reducer arm, and a spec. Never a
  store method that edits the state beside the reducer, and never a copy of
  model state held in a component.
- The reducer's last branch takes `never`, so a tag added without an arm is a
  compile error. Keep it that way.
- Views read by selector. A selector that builds a fresh array or object
  needs zustand's `useShallow` at the call site, or the component re-renders
  on every dispatch.
- A high-frequency gesture reaches the store once, at its end. React Flow
  keeps its own positions during a drag and reports the result on drag stop,
  which is one `MoveElement`.
