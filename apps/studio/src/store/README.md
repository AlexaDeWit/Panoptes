# The studio's model store

One store holds the whole studio: the model on screen, the undo and redo
stacks, the selection, the file lifecycle, and the last refusal. Outside a
spec's reset, `dispatch(action)` is the only way any of it moves, and it
applies one pure `reduce(state, action)`. Views read through selectors and
nothing else.

Zustand hosts it because it is the programming model React Flow 12 is built
on, so the canvas and the studio subscribe the same way and a component
re-renders only when the slice its selector returns changes. The runtime is
not shared: React Flow carries a zustand 4 copy of its own for its internal
store, which is its business and no version this workspace uses. The reducer
shape is the constraint the host had to satisfy, not something it provides.
Redux Toolkit is the same shape with more ceremony and Immer over operations
that are already pure, XState Store dispatches to per-event handlers rather
than one reducer and has a younger API, `useReducer` with context re-renders
every consumer on every dispatch, and jotai and valtio offer no reducer shape
and no immutable snapshot to push onto a stack.

## The shape

- `state.ts` holds `State`, the `FileLifecycle` and `StudioFailure` enums, the
  state a model starts in, and the placeholder model the studio opens on until
  issue #37 can open a file. The stacks hold whole models: the model's
  operations return new models sharing everything they did not change, so a
  snapshot is cheap.
- `actions.ts` is the `Action` union, an Effect `Data.taggedEnum`. Nine tags
  carry a `@panoptes/model` operation and its arguments; the rest are undo,
  redo, selection, and the two ends of the file lifecycle. `Saved` names a file
  as `Opened` does, because a first save is a save-as, and folding both into
  `file` keeps "this model lives in this file" one fact.
- `reducer.ts` is the one pure function, beside the private helpers its arms
  share. It is total: an operation the model refuses leaves the present and
  both stacks alone and records the refusal in `lastFailure`, so no dispatch
  fails and no view handles an error. A successful edit pushes the old present
  onto `past` and clears `future`.
- `store.ts` creates the vanilla store, `dispatch` applies the reducer to it,
  and `useModelStore(selector)` is the React half.
- `selectors.ts` derives what views show. Unsaved work is `present !== saved`
  by identity, so undoing back to the saved point clears it with no
  bookkeeping.

Selection and the file lifecycle stay out of the undo stacks, so an undo moves
the model and leaves the user where they were. A removal clears a selection
that names the element it removed, so `selection` dangles only where a
dispatch selected an id the model never held. Being total, the reducer cannot
refuse `Opened` over unsaved work, so the guard the milestone asks for on
close belongs in the view (#37).

## What a later slice does

- A reducer arm changes the model only by calling a `@panoptes/model`
  operation and folding its `Either`. Never assign into `state.present` or
  into anything it holds: the stacks share those objects, so one write in
  place rewrites every snapshot at once and takes undo, redo and unsaved work
  down together.
- A new mutation is a new action tag, a reducer arm, and a spec. Never a store
  method that edits the state beside the reducer, and never a copy of model
  state held in a component.
- A new kind of refusal is a `StudioFailure` member, not a second field beside
  `lastFailure`, so a view renders one value however the refusal arose.
- The switch carries no default arm, so a tag added without one leaves
  `reduce` without an ending return statement and `noImplicitReturns` refuses
  it. Keep it that way.
- Views read by selector. A selector that builds a fresh array or object needs
  zustand's `useShallow` at the call site, or the component re-renders on every
  dispatch.
- A high-frequency gesture reaches the store once, at its end. React Flow keeps
  its own positions during a drag and reports the result on drag stop, which is
  one `MoveElement`.
