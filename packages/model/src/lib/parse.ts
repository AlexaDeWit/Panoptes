import { Data, Either } from 'effect';
import { z } from 'zod';
import { modelSchema } from './model.js';
import {
  elementIdsAcross,
  elementIdsIn,
  endpointViolationsOf,
  threatIdsOf,
} from './references.js';

type StructuralModel = z.infer<typeof modelSchema>;

type Violation = {
  path: PropertyKey[];
  message: string;
};

const refinedModelSchema = modelSchema.superRefine((model, ctx) => {
  for (const violation of collectViolations(model)) {
    ctx.addIssue({ code: 'custom', ...violation });
  }
});

/**
 * Threat model root. The cross-entity refinements run in {@link parseModel},
 * the only exported way to obtain a Model; the type itself carries no brand
 * and is structurally the schema's inference, so it is not proof that a
 * value passed the refinements.
 */
export type Model = z.infer<typeof refinedModelSchema>;

/**
 * One violation parseModel found: where in the input, what went wrong, and
 * zod's issue code kept as an opaque string for fidelity.
 */
export type ParseIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
  readonly code: string;
};

/**
 * Why parseModel refused an input, as tagged data: zod stays behind the
 * parse boundary, so no zod type appears in the exported surface.
 */
export type ParseFailure = Data.TaggedEnum<{
  InvalidModel: { readonly issues: readonly ParseIssue[] };
}>;

/**
 * Constructor for {@link ParseFailure}: the single InvalidModel variant,
 * plus Effect's `$is` and `$match` helpers. Values compare structurally
 * under Effect's Equal and serialize to their plain tagged shape.
 */
export const ParseFailure = Data.taggedEnum<ParseFailure>();

/**
 * The only way a Model value comes into existence: the structural schema
 * composed with the cross-entity refinements. Enforced: element ids, diagram
 * ids, and threat numbers unique model-wide; threat, mitigation, and
 * assumption ids each unique among their kind; attached flow endpoints
 * anchored to an element of the flow's own diagram and never to the flow
 * itself; every element and threat reference resolving. Fallible APIs in
 * this project return Effect's Either, so this carries the Model on the
 * success channel and a {@link ParseFailure} on the error channel, and
 * does not throw. Each violation is one issue whose path names the
 * offending entry. The refinements run only after a clean structural
 * parse, so a structurally invalid input reports structural issues alone.
 */
export function parseModel(input: unknown): Either.Either<Model, ParseFailure> {
  const result = refinedModelSchema.safeParse(input);
  return result.success
    ? Either.right(result.data)
    : Either.left(toParseFailure(result.error));
}

function toParseFailure(error: z.ZodError<Model>): ParseFailure {
  return ParseFailure.InvalidModel({
    issues: error.issues.map((issue) => ({
      path: issue.path.map((key) =>
        typeof key === 'symbol' ? String(key) : key,
      ),
      message: issue.message,
      code: issue.code,
    })),
  });
}

function collectViolations(model: StructuralModel): Violation[] {
  return [
    ...elementIdViolations(model),
    ...diagramIdViolations(model),
    ...threatNumberViolations(model),
    ...recordIdViolations(model),
    ...flowEndpointViolations(model),
    ...referenceViolations(model),
  ];
}

function duplicateViolations<T>(
  items: readonly T[],
  keyOf: (item: T) => PropertyKey,
  violationOf: (item: T, index: number) => Violation,
): Violation[] {
  const seen = new Set<PropertyKey>();
  const violations: Violation[] = [];
  items.forEach((item, index) => {
    const key = keyOf(item);
    if (seen.has(key)) {
      violations.push(violationOf(item, index));
    }
    seen.add(key);
  });
  return violations;
}

function elementIdViolations(model: StructuralModel): Violation[] {
  const entries = model.diagrams.flatMap((diagram, diagramIndex) =>
    diagram.elements.map((element, elementIndex) => ({
      id: element.id,
      diagramIndex,
      elementIndex,
    })),
  );
  return duplicateViolations(
    entries,
    (entry) => entry.id,
    (entry) => ({
      path: [
        'diagrams',
        entry.diagramIndex,
        'elements',
        entry.elementIndex,
        'id',
      ],
      message: `Duplicate element id "${entry.id}": element ids must be unique across the model.`,
    }),
  );
}

function diagramIdViolations(model: StructuralModel): Violation[] {
  return duplicateViolations(
    model.diagrams,
    (diagram) => diagram.id,
    (diagram, index) => ({
      path: ['diagrams', index, 'id'],
      message: `Duplicate diagram id "${diagram.id}": diagram ids must be unique across the model.`,
    }),
  );
}

function threatNumberViolations(model: StructuralModel): Violation[] {
  return duplicateViolations(
    model.threats,
    (threat) => threat.number,
    (threat, index) => ({
      path: ['threats', index, 'number'],
      message: `Duplicate threat number ${threat.number}: threat numbers must be unique across the model.`,
    }),
  );
}

function recordIdViolations(model: StructuralModel): Violation[] {
  return [
    ...duplicateRecordIds(
      model.threats.map((threat) => threat.id),
      'threats',
      'threat',
    ),
    ...duplicateRecordIds(
      model.mitigations.map((mitigation) => mitigation.id),
      'mitigations',
      'mitigation',
    ),
    ...duplicateRecordIds(
      model.assumptions.map((assumption) => assumption.id),
      'assumptions',
      'assumption',
    ),
  ];
}

function duplicateRecordIds(
  ids: readonly string[],
  collection: 'threats' | 'mitigations' | 'assumptions',
  noun: 'threat' | 'mitigation' | 'assumption',
): Violation[] {
  return duplicateViolations(
    ids,
    (id) => id,
    (id, index) => ({
      path: [collection, index, 'id'],
      message: `Duplicate ${noun} id "${id}": ${noun} ids must be unique among ${collection}.`,
    }),
  );
}

function flowEndpointViolations(model: StructuralModel): Violation[] {
  return model.diagrams.flatMap((diagram, diagramIndex) => {
    const diagramElementIds = elementIdsIn(diagram);
    return diagram.elements.flatMap((element, elementIndex) => {
      if (element.kind !== 'flow') {
        return [];
      }
      return endpointViolationsOf(element, diagramElementIds).map(
        ({ side, reference, reason }) => ({
          path: [
            'diagrams',
            diagramIndex,
            'elements',
            elementIndex,
            side,
            'element',
          ],
          message:
            reason === 'self-anchored'
              ? `Flow ${side} references the flow's own id "${reference}": a flow cannot anchor to itself.`
              : `Flow ${side} references element id "${reference}", which is not in the flow's own diagram.`,
        }),
      );
    });
  });
}

function referenceViolations(model: StructuralModel): Violation[] {
  const elementIds = elementIdsAcross(model.diagrams);
  const threatIds = threatIdsOf(model.threats);
  const references = [
    {
      collection: 'threats',
      entity: 'Threat',
      field: 'elements',
      referent: 'element',
      known: elementIds,
      idLists: model.threats.map((threat) => threat.elements),
    },
    {
      collection: 'assumptions',
      entity: 'Assumption',
      field: 'elements',
      referent: 'element',
      known: elementIds,
      idLists: model.assumptions.map((assumption) => assumption.elements),
    },
    {
      collection: 'mitigations',
      entity: 'Mitigation',
      field: 'threats',
      referent: 'threat',
      known: threatIds,
      idLists: model.mitigations.map((mitigation) => mitigation.threats),
    },
    {
      collection: 'assumptions',
      entity: 'Assumption',
      field: 'threats',
      referent: 'threat',
      known: threatIds,
      idLists: model.assumptions.map((assumption) => assumption.threats),
    },
  ] as const;
  return references.flatMap(
    ({ collection, entity, field, referent, known, idLists }) =>
      idLists.flatMap((ids, recordIndex) =>
        ids.flatMap((id, idIndex): Violation[] =>
          known.has(id)
            ? []
            : [
                {
                  path: [collection, recordIndex, field, idIndex],
                  message: `${entity} ${field} references unknown ${referent} id "${id}".`,
                },
              ],
        ),
      ),
  );
}
