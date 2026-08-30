import { Data } from 'effect';
import type { DiagramId, ElementId, ThreatId } from './ids.js';

/**
 * Why an operation refused to produce a model: `_tag` discriminates the
 * violation, following Effect's own convention, and the remaining fields
 * carry the offending id or reference. Operation failures are relational
 * facts about the model; structural validity of an input value is its own
 * schema's contract. One vocabulary serves every operation module, and each
 * operation's Either narrows its error channel to the members it can
 * actually produce. `ReusedThreatNumber` and `ChangedThreatNumber` guard
 * the same rule from two sides: a threat number is issued once and never
 * moves.
 */
export type OperationFailure = Data.TaggedEnum<{
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
}>;

/**
 * Constructors for {@link OperationFailure}, one per variant, plus
 * Effect's `$is` and `$match` helpers. Values compare structurally under
 * Effect's Equal and serialize to their plain tagged shape.
 */
export const OperationFailure = Data.taggedEnum<OperationFailure>();
