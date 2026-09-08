import type { ParseIssue } from './parse.js';
import { Data } from 'effect';
import type { DiagramId, ElementId, ThreatId } from './ids.js';

/** Why an operation refused to produce a model: `_tag` discriminates the violation, following Effect's own convention, and the remaining fields carry the offending id or reference. */
export type OperationFailure = Data.TaggedEnum<{
  InvalidFragment: { readonly issues: readonly ParseIssue[] };
  UnknownDiagram: { readonly diagramId: DiagramId };
  UnknownElement: { readonly elementId: ElementId };
  UnknownThreat: { readonly threatId: ThreatId };
  DuplicateElementId: { readonly elementId: ElementId };
  DuplicateThreatId: { readonly threatId: ThreatId };
  ReusedThreatNumber: { readonly number: number };
  ChangedThreatNumber: {
    readonly threatId: ThreatId;
    readonly number: number;
  };
  InvalidFlowEndpoint: {
    readonly side: 'source' | 'target';
    readonly reference: ElementId;
  };
  NotResizable: { readonly elementId: ElementId };
  NotTextElement: { readonly elementId: ElementId };
  NotFlowElement: { readonly elementId: ElementId };
  EmptyName: { readonly elementId: ElementId };
  RefusedCharacter: {
    readonly elementId: ElementId;
    readonly at: number;
  };
}>;

/**
 * Constructors for {@link OperationFailure}, one per variant, plus
 * Effect's `$is` and `$match` helpers. Values compare structurally under
 * Effect's Equal and serialize to their plain tagged shape.
 */
export const OperationFailure = Data.taggedEnum<OperationFailure>();
