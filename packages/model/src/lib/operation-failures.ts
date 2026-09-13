import type { ParseIssue } from './parse.js';
import { Data } from 'effect';
import type {
  AssumptionId,
  DiagramId,
  ElementId,
  MitigationId,
  ThreatId,
} from './ids.js';
import type { RecordReference } from './records.js';

/** Why an operation refused to produce a model: `_tag` names the violation and the other fields say where it is. */
export type OperationFailure = Data.TaggedEnum<{
  InvalidElementProperties: {
    readonly elementId: ElementId;
    readonly issues: readonly ParseIssue[];
  };
  InvalidElementRelationship: {
    readonly elementId: ElementId;
    readonly issues: readonly ParseIssue[];
  };
  InvalidFragment: { readonly issues: readonly ParseIssue[] };
  UnknownDiagram: { readonly diagramId: DiagramId };
  DuplicateDiagramId: { readonly diagramId: DiagramId };
  EmptyTitle: { readonly diagramId: DiagramId };
  RefusedTitleCharacter: {
    readonly diagramId: DiagramId;
    readonly at: number;
  };
  DiagramNotEmpty: {
    readonly diagramId: DiagramId;
    readonly elements: number;
  };
  UnknownElement: { readonly elementId: ElementId };
  UnknownThreat: { readonly threatId: ThreatId };
  UnknownMitigation: { readonly mitigationId: MitigationId };
  UnknownAssumption: { readonly assumptionId: AssumptionId };
  DuplicateElementId: { readonly elementId: ElementId };
  DuplicateThreatId: { readonly threatId: ThreatId };
  DuplicateMitigationId: { readonly mitigationId: MitigationId };
  DuplicateAssumptionId: { readonly assumptionId: AssumptionId };
  RecordWithoutThreat: { readonly record: RecordReference };
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
  RefusedMetadataCharacter: {
    readonly field: 'title' | 'owner' | 'description';
    readonly at: number;
  };
  RefusedContributorCharacter: {
    readonly contributor: number;
    readonly at: number;
  };
}>;

/** Constructors for {@link OperationFailure}, with Effect's `$is` and `$match`. */
export const OperationFailure = Data.taggedEnum<OperationFailure>();
