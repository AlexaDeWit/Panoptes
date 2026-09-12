import { quotedForTerminal } from '@saerskriven/formats';
import { OperationFailure, type ParseIssue } from '@saerskriven/model';

/** What the model said about a refused edit, as one line of a result. */
export function describeOperationFailure(failure: OperationFailure): string {
  return OperationFailure.$match(failure, {
    InvalidElementProperties: ({ issues }) =>
      `The element properties were refused: ${issueLine(issues)}`,
    InvalidElementRelationship: ({ issues }) =>
      `The element has invalid boundary relationships: ${issueLine(issues)}`,
    InvalidFragment: ({ issues }) =>
      `The edit does not apply to this model: ${issueLine(issues)}.`,
    UnknownDiagram: ({ diagramId }) =>
      `The model holds no diagram ${quotedForTerminal(diagramId)}.`,
    DuplicateDiagramId: ({ diagramId }) =>
      `The model already holds a diagram ${quotedForTerminal(diagramId)}.`,
    EmptyTitle: ({ diagramId }) =>
      `Diagram ${quotedForTerminal(diagramId)} cannot be left without a title.`,
    RefusedTitleCharacter: ({ diagramId, at }) =>
      `The title for diagram ${quotedForTerminal(diagramId)} carries a character the model does not accept, at index ${String(at)}.`,
    DiagramNotEmpty: ({ diagramId, elements }) =>
      `Diagram ${quotedForTerminal(diagramId)} still holds ${String(elements)} elements, and only an empty diagram is removed.`,
    UnknownElement: ({ elementId }) =>
      `The model holds no element ${quotedForTerminal(elementId)}.`,
    UnknownThreat: ({ threatId }) =>
      `The model holds no threat ${quotedForTerminal(threatId)}.`,
    UnknownMitigation: ({ mitigationId }) =>
      `The model holds no mitigation ${quotedForTerminal(mitigationId)}.`,
    UnknownAssumption: ({ assumptionId }) =>
      `The model holds no assumption ${quotedForTerminal(assumptionId)}.`,
    DuplicateElementId: ({ elementId }) =>
      `The model already holds an element ${quotedForTerminal(elementId)}.`,
    DuplicateThreatId: ({ threatId }) =>
      `The model already holds a threat ${quotedForTerminal(threatId)}.`,
    DuplicateMitigationId: ({ mitigationId }) =>
      `The model already holds a mitigation ${quotedForTerminal(mitigationId)}.`,
    DuplicateAssumptionId: ({ assumptionId }) =>
      `The model already holds an assumption ${quotedForTerminal(assumptionId)}.`,
    RecordWithoutThreat: ({ record }) =>
      `The ${record.kind} ${quotedForTerminal(record.id)} links no threat, and a ${record.kind} is added on a threat.`,
    ReusedThreatNumber: ({ number }) =>
      `Threat number ${String(number)} was issued already, and a number is issued once.`,
    ChangedThreatNumber: ({ threatId, number }) =>
      `Threat ${quotedForTerminal(threatId)} cannot take number ${String(number)}, a number naming one threat for the life of the model.`,
    InvalidFlowEndpoint: ({ side, reference }) =>
      `The flow's ${side} names ${quotedForTerminal(reference)}, which is no actor, process or store of its diagram.`,
    NotResizable: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} has no size to set.`,
    NotTextElement: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} is not a canvas note.`,
    NotFlowElement: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} is not a flow.`,
    EmptyName: ({ elementId }) =>
      `Element ${quotedForTerminal(elementId)} cannot be left without a name.`,
    RefusedCharacter: ({ elementId, at }) =>
      `The text for element ${quotedForTerminal(elementId)} carries a character the model does not accept, at index ${String(at)}.`,
    RefusedMetadataCharacter: ({ field, at }) =>
      `The model ${field} carries a character the model does not accept, at index ${String(at)}.`,
    RefusedContributorCharacter: ({ contributor, at }) =>
      `Entry ${String(contributor)} of the contributors carries a character the model does not accept, at index ${String(at)}.`,
  });
}

function issueLine(issues: readonly ParseIssue[]): string {
  return issues
    .map(
      (issue) =>
        `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
    )
    .join(', ');
}
