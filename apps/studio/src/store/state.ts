import type {
  DetectedRead,
  DetectionFailure,
  FormatName,
  ReadFailure,
} from '@saerskriven/formats';
import {
  emptyModel,
  parseModel,
  type DiagramId,
  type ElementId,
  type Model,
  type OperationFailure,
} from '@saerskriven/model';
import { Data, Either } from 'effect';

type Retained<Read> = Read extends {
  readonly format: FormatName;
  readonly source: unknown;
}
  ? { readonly format: Read['format']; readonly document: Read['source'] }
  : never;

/** The file format and optional wire document that the next save uses. */
export type RetainedSource =
  | Retained<DetectedRead>
  | { readonly format: FormatName; readonly document: undefined };

/** The file name and source stay outside model history. */
export type FileLifecycle = Data.TaggedEnum<{
  NoFile: {};
  Opened: { readonly name: string; readonly source: RetainedSource };
}>;

/**
 * Constructors for {@link FileLifecycle}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const FileLifecycle = Data.taggedEnum<FileLifecycle>();

/** Why the studio refused an operation or could not keep its data. */
export type StudioFailure = Data.TaggedEnum<{
  Operation: { readonly failure: OperationFailure };
  Read: {
    readonly name: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
  File: { readonly reason: string };
  StoredRecoveryRejected: { readonly reason: string };
  RecoveryUnavailable: { readonly reason: string };
}>;

/**
 * Constructors for {@link StudioFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const StudioFailure = Data.taggedEnum<StudioFailure>();

/** The field open over one canvas element. */
export type InlineEditor = {
  readonly kind: 'name' | 'note';
  readonly elementId: ElementId;
};

/**
 * The model, history, transient view state, file, and recovery status.
 * `activeDiagram` names the diagram on screen, and nothing while the first
 * one the model holds is: it stays out of the undo stacks with the rest of
 * the view state, so an undo moves the model and never the view.
 */
export type State = {
  readonly present: Model;
  readonly past: readonly Model[];
  readonly future: readonly Model[];
  readonly saved: Model;
  readonly activeDiagram: DiagramId | undefined;
  readonly selection: readonly ElementId[];
  readonly inlineEditor: InlineEditor | undefined;
  readonly file: FileLifecycle;
  readonly lastFailure: StudioFailure | undefined;
  readonly recoveryCurrent: boolean;
};

/** The name of a model that has never been in a file. */
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
          bidirectional: false,
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

/** The editable model shown before a file or recovery snapshot opens. */
export const placeholderModel: Model = Either.getOrElse(
  parseModel(placeholderDocument),
  () => emptyModel,
);

/** Starts a clean session with empty history and transient state. */
export function initialState(model: Model): State {
  return {
    present: model,
    past: [],
    future: [],
    saved: model,
    activeDiagram: undefined,
    selection: [],
    inlineEditor: undefined,
    file: FileLifecycle.NoFile(),
    lastFailure: undefined,
    recoveryCurrent: false,
  };
}
