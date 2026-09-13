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
  detachThreat,
  diagramIdSchema,
  droppedRecords,
  editNote,
  elementIdSchema,
  mitigationIdSchema,
  mitigationSchema,
  modelMetadataChangeSchema,
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
  setFlowDirection,
  setFlowWaypoints,
  setModelMetadata,
  setElementProperties,
  severitySchema,
  sideSchema,
  sizeSchema,
  threatCategorySchema,
  threatIdSchema,
  threatSchema,
  threatStatusSchema,
  waypointsSchema,
  type Model,
  type RecordReference,
  type ThreatId,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  addedElement,
  addedElementSchema,
  consistentPropertyEdit,
  editedProperties,
  propertyEditSchema,
} from './element-edits.js';
import { describeOperationFailure } from './operation-failure.js';

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

/** Record edits replace records. Property edits patch only the supplied fields. */
export const modelEditSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add_element'),
    diagram: diagramIdSchema.describe('The diagram the element joins.'),
    element: addedElementSchema,
  }),
  elementEditSchema
    .extend(propertyEditSchema.shape)
    .extend({
      op: z.literal('set_element_properties'),
    })
    .refine(consistentPropertyEdit, {
      message:
        'Unset fields must belong to the element kind and cannot also have a value.',
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
    op: z.literal('set_flow_direction'),
    bidirectional: z
      .boolean()
      .describe(
        'Whether data moves both ways along the flow. The flow keeps its id, so the threats attached to it stay attached.',
      ),
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
  modelMetadataChangeSchema
    .extend({ op: z.literal('set_model_metadata') })
    .describe(
      'Sets any of the model title, owner, description and contributors. A field left out keeps its value, and `contributors` replaces the whole list.',
    ),
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

/** A batch applied: the model it produced and the records it culled. */
export type AppliedBatch = {
  readonly model: Model;
  readonly culled: readonly RecordReference[];
};

/**
 * Applies a batch in order and returns its first refusal. `culled` names,
 * once each, every record an edit other than `remove_mitigation` or
 * `remove_assumption` took out of the model, where the model the batch
 * started from held that record. The caller owns file writes.
 */
export function applyEdits(
  model: Model,
  edits: readonly ModelEdit[],
): Either.Either<AppliedBatch, RefusedEdit> {
  const held = new Set([
    ...model.mitigations.map(({ id }) => recordKey({ kind: 'mitigation', id })),
    ...model.assumptions.map(({ id }) => recordKey({ kind: 'assumption', id })),
  ]);
  return Either.map(
    edits.reduce<Either.Either<AppliedBatch, RefusedEdit>>(
      (carried, edit, index) =>
        Either.flatMap(carried, (batch) =>
          Either.mapBoth(applyEdit(batch.model, edit), {
            onLeft: (failure) => ({ index, failure }),
            onRight: (next) => ({
              model: next,
              culled: [
                ...batch.culled,
                ...(isRemoval(edit) ? [] : droppedRecords(batch.model, next)),
              ],
            }),
          }),
        ),
      Either.right({ model, culled: [] }),
    ),
    (batch) => ({
      model: batch.model,
      culled: [
        ...new Map(
          batch.culled
            .filter((record) => held.has(recordKey(record)))
            .map((record) => [recordKey(record), record]),
        ).values(),
      ],
    }),
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
        addedElement(edit.element, placementIndex(model, edit.diagram)),
      );
    case 'set_element_properties':
      return setElementProperties(model, edit.element, editedProperties(edit));
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
    case 'set_flow_direction':
      return setFlowDirection(model, edit.element, edit.bidirectional);
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
    case 'set_model_metadata':
      return setModelMetadata(model, edit);
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

function isRemoval(edit: ModelEdit): boolean {
  return edit.op === 'remove_mitigation' || edit.op === 'remove_assumption';
}

function recordKey(record: RecordReference): string {
  return `${record.kind} ${record.id}`;
}
