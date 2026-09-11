import type {
  DetectionFailure,
  Divergence,
  ReadFailure,
} from '@saerskriven/formats';
import type {
  Diagram,
  DiagramId,
  Element,
  ElementId,
  Model,
  Point,
  Side,
  Size,
  Threat,
  ThreatId,
} from '@saerskriven/model';
import { Data } from 'effect';
import type { InlineEditor, RetainedSource } from './state.js';

/** Every state change the reducer accepts. */
export type Action = Data.TaggedEnum<{
  AddElement: { readonly diagramId: DiagramId; readonly element: Element };
  InsertFragment: { readonly diagramId: DiagramId; readonly fragment: Model };
  ArrangeElements: {
    readonly moves: readonly {
      readonly elementId: ElementId;
      readonly offset: Point;
    }[];
  };
  ReconnectFlow: {
    readonly elementId: ElementId;
    readonly side: 'source' | 'target';
    readonly endpointId: ElementId;
    readonly anchor?: Side;
  };
  SetFlowDirection: {
    readonly elementId: ElementId;
    readonly bidirectional: boolean;
  };
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
  SetFlowWaypoints: {
    readonly elementId: ElementId;
    readonly waypoints: readonly Point[];
  };
  AddThreat: { readonly threat: Threat };
  RemoveThreat: { readonly threatId: ThreatId };
  ReplaceThreat: { readonly threat: Threat };
  AttachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  DetachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  AddDiagram: { readonly diagram: Diagram };
  RenameDiagram: { readonly diagramId: DiagramId; readonly title: string };
  Undo: {};
  Redo: {};
  SelectDiagram: { readonly diagramId: DiagramId };
  Select: { readonly elementIds: readonly ElementId[] };
  InlineEditing: { readonly editor: InlineEditor | undefined };
  Opened: {
    readonly model: Model;
    readonly name: string;
    readonly source: RetainedSource;
    readonly divergences: readonly Divergence[];
  };
  Imported: {
    readonly model: Model;
    readonly name: string;
    readonly divergences: readonly Divergence[];
  };
  ImportFailed: { readonly name: string; readonly failure: ReadFailure };
  Saved: { readonly name: string; readonly source: RetainedSource };
  Closed: {};
  ReadFailed: {
    readonly name: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
  FileRefused: {
    readonly operation: 'open' | 'save' | 'import';
    readonly reason: string;
  };
}>;

/** Constructors and matching helpers for store actions. */
export const Action = Data.taggedEnum<Action>();
