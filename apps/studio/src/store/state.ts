import type {
  DetectedRead,
  DetectionFailure,
  FormatName,
  ReadFailure,
} from '@panoptes/formats';
import {
  emptyModel,
  parseModel,
  type ElementId,
  type Model,
  type OperationFailure,
} from '@panoptes/model';
import { Data, Either } from 'effect';

type Retained<Read> = Read extends {
  readonly format: FormatName;
  readonly source: unknown;
}
  ? { readonly format: Read['format']; readonly document: Read['source'] }
  : never;

/**
 * Where a save writes from: a format, and either the wire document a read of
 * that format retained or nothing at all. Given a document the save merges
 * onto it, so what Panoptes does not model survives the round trip; given
 * none the codec projects the model, which is what a save into a format the
 * model was not read from has to do.
 *
 * The paired half is derived from the formats package's own detected-read
 * union, so a document cannot be filed under the wrong format and
 * `codec.write(model, document)` type-checks after one narrowing. The
 * document is plain data, as everything in the state is.
 */
export type RetainedSource =
  | Retained<DetectedRead>
  | { readonly format: FormatName; readonly document: undefined };

/**
 * Where the studio stands with a file. `NoFile` is the studio before
 * anything is opened, and `Opened` names the file a save writes back to,
 * with the source a merge writes onto. The file is not in the undo stacks:
 * an undo moves the model and leaves the file it lives in alone.
 */
export type FileLifecycle = Data.TaggedEnum<{
  NoFile: {};
  Opened: { readonly name: string; readonly source: RetainedSource };
}>;

/**
 * Constructors for {@link FileLifecycle}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const FileLifecycle = Data.taggedEnum<FileLifecycle>();

/**
 * Why the studio could not do what a view asked of it, as one union rather
 * than a field per kind, so a view renders one value however the refusal
 * arose. `Operation` is the model refusing an edit. `Read` is a file that
 * arrived whole and that no codec could make a model of, carrying the
 * codec's own failure so the view renders its paths rather than a sentence
 * the store invented. `File` is the file itself never arriving or
 * never being written, which is the platform's answer and no codec's, so it
 * carries what the platform said and no path into a document.
 */
export type StudioFailure = Data.TaggedEnum<{
  Operation: { readonly failure: OperationFailure };
  Read: {
    readonly name: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
  File: { readonly reason: string };
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
 * the next change to the model and by the next save that lands, a save being
 * the answer to the refusal it followed. The reasoning behind the shape is in
 * this directory's README.
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

/**
 * What a model that has never been in a file is called. It is the
 * placeholder's own title rather than a word a view supplies, so the tab,
 * the file controls and a saved file all read one string.
 */
export const untitledModel = 'Untitled';

const placeholderDocument = {
  metadata: {
    title: untitledModel,
    owner: '',
    description: '',
    contributors: [],
  },
  diagrams: [
    {
      id: 'placeholder-diagram',
      title: 'Untitled diagram',
      elements: [
        {
          kind: 'actor',
          id: 'placeholder-actor',
          name: 'Actor',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 40 },
          size: { width: 100, height: 50 },
        },
        {
          kind: 'store',
          id: 'placeholder-store',
          name: 'Store',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 280, y: 40 },
          size: { width: 100, height: 50 },
        },
        {
          kind: 'flow',
          id: 'placeholder-flow',
          name: 'Records',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: 'placeholder-actor' },
          target: { kind: 'attached', element: 'placeholder-store' },
          waypoints: [],
        },
      ],
    },
  ],
  threats: [
    {
      id: 'placeholder-threat',
      number: 1,
      title: 'The actor sends records nothing has checked',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'medium',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['placeholder-actor'],
    },
  ],
  lastIssuedThreatNumber: 1,
  mitigations: [],
  assumptions: [],
};

/**
 * The model the studio starts on, so there is a diagram and a threat to edit
 * before a file is opened. Opening one replaces it with the model that file
 * carries. It comes through parseModel, and folds to the model package's
 * empty model rather than throwing if the literal ever stops parsing.
 *
 * It draws the smallest thing that is still a data-flow diagram: an actor,
 * the records it sends, and the store they land in. Each box is a hundred by
 * fifty units: a two-to-one box on the grid the studio rules, chosen for its
 * proportion, whose eighty-eight units inside the padding hold a five-column
 * name of thirty-three at the canvas type size by the canvas package's own
 * estimate, and whose height is one line plus that padding rounded up to the
 * grid. So no name wraps. The gap between the two boxes is what leaves the
 * flow's name a place to hang clear of both, which the layout's own
 * placement settles and `state.spec.ts` holds.
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
