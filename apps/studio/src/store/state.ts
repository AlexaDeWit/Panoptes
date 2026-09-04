import type { FormatName } from '@panoptes/formats';
import {
  emptyModel,
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
 * Why the studio could not do what a view asked of it. One member today, the
 * model refusing an operation. Issue #37's read and write failures join it
 * as members of this union rather than as a second field beside it, so a
 * view renders one value however the refusal arose.
 */
export type StudioFailure = Data.TaggedEnum<{
  Operation: { readonly failure: OperationFailure };
}>;

/**
 * Constructors for {@link StudioFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const StudioFailure = Data.taggedEnum<StudioFailure>();

/**
 * Everything the studio holds. `present` is the model on screen, and `past`
 * and `future` are the undo and redo stacks, each entry a whole model and
 * nothing else. `saved` is the model the open file holds, `selection` names
 * an element of `present`, and `lastFailure` is the last refusal, cleared by
 * the next change to the model. The reasoning behind the shape is in this
 * directory's README.
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
  readonly lastFailure: StudioFailure | undefined;
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
 * edit before anything can be opened. Issue #37 replaces it with the model a
 * file carries, dispatched as an `Opened` action. It comes through
 * parseModel, and folds to the model package's empty model rather than
 * throwing if the literal ever stops parsing.
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
