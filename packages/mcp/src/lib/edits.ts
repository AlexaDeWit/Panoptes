import { quotedForTerminal } from '@saerskriven/formats';
import {
  OperationFailure,
  acceptedTextSchema,
  addAssumption,
  addDiagram,
  addElement,
  addMitigation,
  addThreat,
  assumptionIdSchema,
  assumptionSchema,
  attachThreat,
  autoExtent,
  autoPlacement,
  boundaryShapeSchema,
  detachThreat,
  diagramIdSchema,
  editNote,
  elementIdSchema,
  flowEndpointSchema,
  mitigationIdSchema,
  mitigationSchema,
  moveElement,
  nextThreatNumber,
  pointSchema,
  reconnectFlow,
  removeAssumption,
  removeDiagram,
  removeElement,
  removeMitigation,
  removeThreat,
  renameDiagram,
  renameElement,
  replaceAssumption,
  replaceMitigation,
  replaceThreat,
  resizeElement,
  setFlowWaypoints,
  severitySchema,
  sideSchema,
  sizeSchema,
  threatCategorySchema,
  threatIdSchema,
  threatSchema,
  threatStatusSchema,
  waypointsSchema,
  type Element,
  type Model,
  type ParseIssue,
  type Point,
  type Size,
  type ThreatId,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';

const placementSchema = z.union([
  z.literal('auto'),
  z.object({ position: pointSchema, size: sizeSchema }),
]);

const addedElementSchema = z.object({
  id: elementIdSchema,
  name: acceptedTextSchema,
  description: acceptedTextSchema.default(''),
  outOfScope: z.boolean().default(false),
  reasonOutOfScope: acceptedTextSchema.default(''),
});

const placedElementSchema = addedElementSchema.extend({
  placement: placementSchema.describe(
    'Where the element goes: an object carrying `position` and `size` in canvas units, or "auto" to take the next place on the shared grid at a nominal extent. Pass "auto" unless the layout matters, and move or resize the element afterwards where it does.',
  ),
});

const addedElementUnionSchema = z.discriminatedUnion('kind', [
  placedElementSchema.extend({ kind: z.literal('actor') }),
  placedElementSchema.extend({ kind: z.literal('process') }),
  placedElementSchema.extend({ kind: z.literal('store') }),
  placedElementSchema.extend({
    kind: z.literal('text'),
    text: acceptedTextSchema,
  }),
  addedElementSchema.extend({
    kind: z.literal('trust-boundary'),
    shape: boundaryShapeSchema,
  }),
  addedElementSchema.extend({
    kind: z.literal('flow'),
    source: flowEndpointSchema,
    target: flowEndpointSchema,
    waypoints: waypointsSchema.default([]),
    bidirectional: z.boolean().default(false),
  }),
]);

const elementEditSchema = z.object({
  element: elementIdSchema.describe('The id of the element to edit.'),
});

const threatEditSchema = z.object({
  threat: threatIdSchema.describe('The id of the threat to edit.'),
});

const diagramEditSchema = z.object({
  diagram: diagramIdSchema.describe('The id of the diagram.'),
});

const threatFieldsSchema = threatSchema.omit({ number: true });

/** An edit supplies a whole record, except the threat number owned by the model. */
export const modelEditSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_element'),
    diagram: diagramIdSchema.describe('The diagram the element joins.'),
    element: addedElementUnionSchema,
  }),
  elementEditSchema.extend({ op: z.literal('remove_element') }),
  elementEditSchema.extend({
    op: z.literal('move_element'),
    offset: pointSchema.describe('How far to translate the element.'),
  }),
  elementEditSchema.extend({
    op: z.literal('resize_element'),
    size: sizeSchema,
  }),
  elementEditSchema.extend({
    op: z.literal('rename_element'),
    name: acceptedTextSchema,
  }),
  elementEditSchema.extend({
    op: z.literal('edit_note'),
    text: acceptedTextSchema,
  }),
  elementEditSchema.extend({
    op: z.literal('set_flow_waypoints'),
    waypoints: waypointsSchema,
  }),
  elementEditSchema.extend({
    op: z.literal('reconnect_flow'),
    side: z.enum(['source', 'target']),
    endpoint: elementIdSchema.describe(
      'The actor, process or store the end moves to.',
    ),
    anchor: sideSchema
      .optional()
      .describe(
        'The side of the endpoint the flow fastens to. Left out, the renderer chooses.',
      ),
  }),
  z.object({ op: z.literal('add_threat'), threat: threatFieldsSchema }),
  z.object({ op: z.literal('replace_threat'), threat: threatFieldsSchema }),
  threatEditSchema.extend({ op: z.literal('remove_threat') }),
  threatEditSchema.extend({
    op: z.literal('attach_threat'),
    element: elementIdSchema,
  }),
  threatEditSchema.extend({
    op: z.literal('detach_threat'),
    element: elementIdSchema,
  }),
  threatEditSchema.extend({
    op: z.literal('set_threat_status'),
    status: threatStatusSchema,
  }),
  threatEditSchema.extend({
    op: z.literal('set_threat_severity'),
    severity: severitySchema,
  }),
  threatEditSchema.extend({
    op: z.literal('set_threat_category'),
    category: threatCategorySchema,
  }),
  z.object({ op: z.literal('add_mitigation'), mitigation: mitigationSchema }),
  z.object({
    op: z.literal('replace_mitigation'),
    mitigation: mitigationSchema,
  }),
  z.object({
    op: z.literal('remove_mitigation'),
    mitigation: mitigationIdSchema,
  }),
  z.object({ op: z.literal('add_assumption'), assumption: assumptionSchema }),
  z.object({
    op: z.literal('replace_assumption'),
    assumption: assumptionSchema,
  }),
  z.object({
    op: z.literal('remove_assumption'),
    assumption: assumptionIdSchema,
  }),
  diagramEditSchema.extend({
    op: z.literal('add_diagram'),
    title: acceptedTextSchema,
  }),
  diagramEditSchema.extend({
    op: z.literal('rename_diagram'),
    title: acceptedTextSchema,
  }),
  diagramEditSchema.extend({ op: z.literal('remove_diagram') }),
]);

/** One edit of a batch. */
export type ModelEdit = z.infer<typeof modelEditSchema>;

/** Edit names follow the schema so tool documentation cannot omit a variant. */
export const editOps: readonly ModelEdit['op'][] = modelEditSchema.options.map(
  (option) => option.shape.op.value,
);

/** Which edit of a batch the model refused, and why. */
export type RefusedEdit = {
  readonly index: number;
  readonly failure: OperationFailure;
};

/** Applies a batch in order and returns its first refusal. The caller owns file writes. */
export function applyEdits(
  model: Model,
  edits: readonly ModelEdit[],
): Either.Either<Model, RefusedEdit> {
  return edits.reduce<Either.Either<Model, RefusedEdit>>(
    (carried, edit, index) =>
      Either.flatMap(carried, (current) =>
        Either.mapLeft(applyEdit(current, edit), (failure) => ({
          index,
          failure,
        })),
      ),
    Either.right(model),
  );
}

/** Which edit was refused and what the model said, as lines for a result. */
export function renderRefusedEdit(refused: RefusedEdit): readonly string[] {
  return [
    `The edit at index ${String(refused.index)} was refused, so none of the batch was applied and the file is as it was.`,
    describeOperationFailure(refused.failure),
  ];
}

function applyEdit(
  model: Model,
  edit: ModelEdit,
): Either.Either<Model, OperationFailure> {
  switch (edit.op) {
    case 'add_element':
      return addElement(
        model,
        edit.diagram,
        elementOf(edit.element, placementIndex(model, edit.diagram)),
      );
    case 'remove_element':
      return removeElement(model, edit.element);
    case 'move_element':
      return moveElement(model, edit.element, edit.offset);
    case 'resize_element':
      return resizeElement(model, edit.element, edit.size);
    case 'rename_element':
      return renameElement(model, edit.element, edit.name);
    case 'edit_note':
      return editNote(model, edit.element, edit.text);
    case 'set_flow_waypoints':
      return setFlowWaypoints(model, edit.element, edit.waypoints);
    case 'reconnect_flow':
      return reconnectFlow(
        model,
        edit.element,
        edit.side,
        edit.endpoint,
        edit.anchor,
      );
    case 'add_threat':
      return addThreat(model, {
        ...edit.threat,
        number: nextThreatNumber(model),
      });
    case 'replace_threat':
      return withThreat(model, edit.threat.id, (held) => ({
        ...edit.threat,
        number: held.number,
      }));
    case 'remove_threat':
      return removeThreat(model, edit.threat);
    case 'attach_threat':
      return attachThreat(model, edit.threat, edit.element);
    case 'detach_threat':
      return detachThreat(model, edit.threat, edit.element);
    case 'set_threat_status':
      return withThreat(model, edit.threat, (held) => ({
        ...held,
        status: edit.status,
      }));
    case 'set_threat_severity':
      return withThreat(model, edit.threat, (held) => ({
        ...held,
        severity: edit.severity,
      }));
    case 'set_threat_category':
      return withThreat(model, edit.threat, (held) => ({
        ...held,
        category: edit.category,
      }));
    case 'add_mitigation':
      return addMitigation(model, edit.mitigation);
    case 'replace_mitigation':
      return replaceMitigation(model, edit.mitigation);
    case 'remove_mitigation':
      return removeMitigation(model, edit.mitigation);
    case 'add_assumption':
      return addAssumption(model, edit.assumption);
    case 'replace_assumption':
      return replaceAssumption(model, edit.assumption);
    case 'remove_assumption':
      return removeAssumption(model, edit.assumption);
    case 'add_diagram':
      return addDiagram(model, {
        id: edit.diagram,
        title: edit.title,
        elements: [],
      });
    case 'rename_diagram':
      return renameDiagram(model, edit.diagram, edit.title);
    case 'remove_diagram':
      return removeDiagram(model, edit.diagram);
    default:
      return unapplied(edit);
  }
}

function unapplied(_edit: never): Either.Either<Model, OperationFailure> {
  return Either.left(
    OperationFailure.InvalidFragment({
      issues: [
        {
          path: ['op'],
          code: 'invalid_value',
          message: 'no operation of this server applies it',
        },
      ],
    }),
  );
}

function withThreat(
  model: Model,
  threatId: ThreatId,
  change: (held: z.infer<typeof threatSchema>) => z.infer<typeof threatSchema>,
): Either.Either<Model, OperationFailure> {
  const held = model.threats.find((candidate) => candidate.id === threatId);
  return held === undefined
    ? Either.left(OperationFailure.UnknownThreat({ threatId }))
    : replaceThreat(model, change(held));
}

function placementIndex(model: Model, diagramId: string): number {
  return (
    model.diagrams.find((diagram) => diagram.id === diagramId)?.elements
      .length ?? 0
  );
}

function elementOf(
  added: z.infer<typeof addedElementUnionSchema>,
  index: number,
): Element {
  const named = {
    id: added.id,
    name: added.name,
    description: added.description,
    outOfScope: added.outOfScope,
    reasonOutOfScope: added.reasonOutOfScope,
  };
  if (added.kind === 'trust-boundary') {
    return { ...named, kind: 'trust-boundary', shape: added.shape };
  }
  if (added.kind === 'flow') {
    return {
      ...named,
      kind: 'flow',
      source: added.source,
      target: added.target,
      waypoints: added.waypoints,
      bidirectional: added.bidirectional,
    };
  }
  if (added.kind === 'text') {
    return {
      ...named,
      kind: 'text',
      text: added.text,
      ...placed(added.placement, index),
    };
  }
  return { ...named, kind: added.kind, ...placed(added.placement, index) };
}

function placed(
  placement: z.infer<typeof placementSchema>,
  index: number,
): { readonly position: Point; readonly size: Size } {
  return placement === 'auto'
    ? { position: autoPlacement(index), size: autoExtent }
    : { position: placement.position, size: placement.size };
}

function describeOperationFailure(failure: OperationFailure): string {
  return OperationFailure.$match(failure, {
    InvalidElementRelationship: ({ issues }) =>
      `The element has invalid boundary relationships: ${issueLine(issues)}.`,
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
