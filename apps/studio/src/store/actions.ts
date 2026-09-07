import type {
  DetectionFailure,
  Divergence,
  ReadFailure,
} from '@saerskriven/formats';
import type {
  DiagramId,
  Element,
  ElementId,
  Model,
  Point,
  Size,
  Threat,
  ThreatId,
} from '@saerskriven/model';
import { Data } from 'effect';
import type { InlineEditor, RetainedSource } from './state.js';

/** Every state change the reducer accepts. */
export type Action = Data.TaggedEnum<{
  AddElement: { readonly diagramId: DiagramId; readonly element: Element };
  RemoveElement: { readonly elementId: ElementId };
  RemoveElements: { readonly elementIds: readonly ElementId[] };
  MoveElement: { readonly elementId: ElementId; readonly offset: Point };
  MoveElements: {
    readonly elementIds: readonly ElementId[];
    readonly offset: Point;
  };
  ResizeElement: {
    readonly elementId: ElementId;
    readonly offset: Point;
    readonly size: Size;
  };
  RenameElement: { readonly elementId: ElementId; readonly name: string };
  EditNote: { readonly elementId: ElementId; readonly text: string };
  AddThreat: { readonly threat: Threat };
  RemoveThreat: { readonly threatId: ThreatId };
  ReplaceThreat: { readonly threat: Threat };
  AttachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  DetachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  Undo: {};
  Redo: {};
  Select: { readonly elementIds: readonly ElementId[] };
  InlineEditing: { readonly editor: InlineEditor | undefined };
  Opened: {
    readonly model: Model;
    readonly name: string;
    readonly source: RetainedSource;
    readonly divergences: readonly Divergence[];
  };
  Saved: { readonly name: string; readonly source: RetainedSource };
  Closed: {};
  ReadFailed: {
    readonly name: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
  FileRefused: { readonly operation: 'open' | 'save'; readonly reason: string };
}>;

/** Constructors and matching helpers for store actions. */
export const Action = Data.taggedEnum<Action>();
