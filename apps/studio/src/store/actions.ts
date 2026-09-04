import type { FormatName } from '@panoptes/formats';
import type {
  DiagramId,
  Element,
  ElementId,
  Model,
  Point,
  Size,
  Threat,
  ThreatId,
} from '@panoptes/model';
import { Data } from 'effect';

/**
 * Everything that can change the studio's state. Nine tags carry a model
 * operation and nothing else, each holding exactly the arguments that
 * operation takes, so the reducer applies one and folds its answer. The
 * remaining five are the studio's own: the two history moves, selection, and
 * the two ends of the file lifecycle. `Opened` and `Saved` both name a file,
 * because a first save is a save-as and settles which file the model lives
 * in.
 *
 * The union is bounded and the reducer is exhaustive over it, so a tag added
 * here without an arm beside it is a compile error rather than a silent
 * no-op. A new mutation is a new tag, never a store method that edits the
 * state on its own.
 */
export type Action = Data.TaggedEnum<{
  AddElement: { readonly diagramId: DiagramId; readonly element: Element };
  RemoveElement: { readonly elementId: ElementId };
  MoveElement: { readonly elementId: ElementId; readonly offset: Point };
  ResizeElement: { readonly elementId: ElementId; readonly size: Size };
  AddThreat: { readonly threat: Threat };
  RemoveThreat: { readonly threatId: ThreatId };
  ReplaceThreat: { readonly threat: Threat };
  AttachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  DetachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  Undo: {};
  Redo: {};
  Select: { readonly elementId: ElementId | undefined };
  Opened: {
    readonly model: Model;
    readonly name: string;
    readonly format: FormatName;
  };
  Saved: { readonly name: string; readonly format: FormatName };
}>;

/**
 * Constructors for {@link Action}, one per tag, plus Effect's `$is` and
 * `$match` helpers.
 */
export const Action = Data.taggedEnum<Action>();
