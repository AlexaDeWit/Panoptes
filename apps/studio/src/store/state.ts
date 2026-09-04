import type { FormatName } from '@panoptes/formats';
import {
  parseModel,
  type ElementId,
  type Model,
  type OperationFailure,
} from '@panoptes/model';
import { Data, Either } from 'effect';

/**
 * Where the studio stands with a file. `NoFile` is the studio before
 * anything is opened, and `Opened` names the file a save writes back to.
 * The open and save paths are issue #37's, and this grows with them; it
 * carries the least a save needs until then.
 */
export type FileLifecycle = Data.TaggedEnum<{
  NoFile: {};
  Opened: { readonly name: string; readonly format: FormatName };
}>;

/**
 * Constructors for {@link FileLifecycle}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const FileLifecycle = Data.taggedEnum<FileLifecycle>();

/**
 * Everything the studio holds. `present` is the model on screen, `past` and
 * `future` the undo and redo stacks, each entry a whole model: the model's
 * operations return new models sharing everything they did not change, so a
 * snapshot costs a few objects rather than a copy of the model.
 *
 * The stacks hold models alone. Selection and the file lifecycle stay out of
 * them, so an undo moves the model and leaves the user where they were.
 * `saved` is the model the file holds, which is what makes unsaved work a
 * selector over identity rather than a flag to keep in step. `lastFailure`
 * is the operation the model refused, and clears on the next change to the
 * model.
 *
 * The state is never parsed and never written to a file, so it is the one
 * shape here with no schema behind it.
 */
export type State = {
  readonly present: Model;
  readonly past: readonly Model[];
  readonly future: readonly Model[];
  readonly saved: Model;
  readonly selection: ElementId | undefined;
  readonly file: FileLifecycle;
  readonly lastFailure: OperationFailure | undefined;
};

/**
 * A model with nothing in it. Written out rather than parsed because every
 * collection is empty: no id to collide, no reference to resolve, so no
 * refinement parseModel adds has anything to check.
 */
export const emptyModel: Model = {
  metadata: { title: '', owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};

const placeholderDocument = {
  metadata: {
    title: 'Placeholder model',
    owner: '',
    description: 'Stands in for a file until the studio can open one.',
    contributors: [],
  },
  diagrams: [
    {
      id: 'placeholder-diagram',
      title: 'Placeholder diagram',
      elements: [
        {
          kind: 'actor',
          id: 'placeholder-actor',
          name: 'Reader',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 40 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'process',
          id: 'placeholder-process',
          name: 'Studio',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 240, y: 40 },
          size: { width: 120, height: 60 },
        },
      ],
    },
  ],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};

/**
 * The model the studio starts on, so the walking skeleton has a diagram to
 * edit before anything can be opened. Issue #37 replaces it with the model
 * a file carries, dispatched as an `Opened` action. It comes through
 * parseModel, the only way a model comes into existence, and folds to
 * {@link emptyModel} rather than throwing if the literal ever stops parsing.
 */
export const placeholderModel: Model = Either.getOrElse(
  parseModel(placeholderDocument),
  () => emptyModel,
);

/**
 * The state a model starts in: nothing to undo, nothing to redo, and the
 * model already its own saved copy, so the studio opens clean.
 */
export function initialState(model: Model): State {
  return {
    present: model,
    past: [],
    future: [],
    saved: model,
    selection: undefined,
    file: FileLifecycle.NoFile(),
    lastFailure: undefined,
  };
}
