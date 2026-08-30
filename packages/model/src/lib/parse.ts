import { z } from 'zod';
import { modelSchema } from './model.js';

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
 * The only way a Model value comes into existence: the structural schema
 * composed with the cross-entity refinements. Enforced: element ids, diagram
 * ids, and threat numbers unique model-wide; threat, mitigation, and
 * assumption ids each unique among their kind; attached flow endpoints
 * anchored to an element of the flow's own diagram and never to the flow
 * itself; every element and threat reference resolving. Fallible operations
 * in this project return result unions, so this returns zod's discriminated
 * result and does not throw. Each violation is one issue whose path names
 * the offending entry. The refinements run only after a clean structural
 * parse, so a structurally invalid input reports structural issues alone.
 */
export function parseModel(input: unknown): z.ZodSafeParseResult<Model> {
  return refinedModelSchema.safeParse(input);
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
    const diagramElementIds = new Set<string>(
      diagram.elements.map((element) => element.id),
    );
    return diagram.elements.flatMap((element, elementIndex) => {
      if (element.kind !== 'flow') {
        return [];
      }
      return (['source', 'target'] as const).flatMap((side): Violation[] => {
        const endpoint = element[side];
        if (endpoint.kind !== 'attached') {
          return [];
        }
        const path = [
          'diagrams',
          diagramIndex,
          'elements',
          elementIndex,
          side,
          'element',
        ];
        if (endpoint.element === element.id) {
          return [
            {
              path,
              message: `Flow ${side} references the flow's own id "${endpoint.element}": a flow cannot anchor to itself.`,
            },
          ];
        }
        if (!diagramElementIds.has(endpoint.element)) {
          return [
            {
              path,
              message: `Flow ${side} references element id "${endpoint.element}", which is not in the flow's own diagram.`,
            },
          ];
        }
        return [];
      });
    });
  });
}

function referenceViolations(model: StructuralModel): Violation[] {
  const elementIds = new Set<string>(
    model.diagrams.flatMap((diagram) =>
      diagram.elements.map((element) => element.id),
    ),
  );
  const threatIds = new Set<string>(model.threats.map((threat) => threat.id));
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
