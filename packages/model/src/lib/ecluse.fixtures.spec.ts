import { Either } from 'effect';
import { assumptionStatusSchema } from './assumptions.js';
import { threatCategorySchema } from './categories.js';
import {
  elementsWithoutThreats,
  openThreatsBySeverity,
  threatCountByElement,
} from './coverage.js';
import { ecluseFixture } from './ecluse.fixtures.js';
import {
  boundaryShapeSchema,
  elementSchema,
  flowEndpointSchema,
  type Element,
  type Flow,
  type TrustBoundary,
} from './elements.js';
import { elementId, parsedFixture } from './fixtures.js';
import { mitigationStatusSchema } from './mitigations.js';
import { parseModel, type Model, type ParseIssue } from './parse.js';
import { elementsAcross } from './references.js';
import { severitySchema, threatStatusSchema } from './threats.js';
import { vocabularyComplementFixture } from './vocabulary.fixtures.js';

const ecluse = parsedFixture(ecluseFixture);
const complement = parsedFixture(vocabularyComplementFixture);
const fixtures = [ecluse, complement];

const issuesOf = (input: unknown): readonly ParseIssue[] => {
  const result = parseModel(input);
  return Either.isLeft(result) ? result.left.issues : [];
};

const tally = (values: readonly string[]): Record<string, number> =>
  values.reduce<Record<string, number>>(
    (counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }),
    {},
  );

const spanning = (reach: (model: Model) => readonly string[]): Set<string> =>
  new Set(fixtures.flatMap(reach));

const enumeratedCategories = threatCategorySchema.options.flatMap(
  (option): [string, readonly string[]][] =>
    'options' in option.shape.category
      ? [[option.shape.methodology.value, option.shape.category.options]]
      : [],
);

const categoriesUnder =
  (methodology: string) =>
  (model: Model): string[] =>
    model.threats.flatMap((threat) =>
      threat.category.methodology === methodology
        ? [threat.category.category]
        : [],
    );

const elementsOf = (model: Model): Element[] => elementsAcross(model.diagrams);

const flowsOf = (model: Model): Flow[] =>
  elementsOf(model).filter((element) => element.kind === 'flow');

const boundariesOf = (model: Model): TrustBoundary[] =>
  elementsOf(model).filter((element) => element.kind === 'trust-boundary');

describe('ecluseFixture', () => {
  it('parses through parseModel', () => {
    expect(issuesOf(ecluseFixture)).toEqual([]);
  });

  it('credits the one contributor the source file names', () => {
    expect(ecluse.metadata.contributors).toEqual(['Alexandra de Wit']);
  });

  it('holds the source diagram whole, 38 elements over five kinds', () => {
    expect(ecluse.diagrams).toHaveLength(1);
    expect(elementsOf(ecluse)).toHaveLength(38);
    expect(tally(elementsOf(ecluse).map((element) => element.kind))).toEqual({
      actor: 4,
      process: 5,
      store: 6,
      flow: 20,
      'trust-boundary': 3,
    });
  });

  it('draws every trust boundary as a box, the only shape the source uses', () => {
    expect(
      tally(boundariesOf(ecluse).map((boundary) => boundary.shape.kind)),
    ).toEqual({ box: 3 });
  });

  it('keeps the one flow endpoint the source leaves off an element', () => {
    const unattached = flowsOf(ecluse).filter(
      (flow) => flow.source.kind === 'free' || flow.target.kind === 'free',
    );
    expect(unattached.map((flow) => flow.name)).toEqual([
      'OSV Dataset for Supported Registries',
    ]);
    expect(unattached[0]?.source).toEqual({
      kind: 'free',
      position: { x: 1480, y: 860 },
    });
  });

  it('keeps every element in scope, as the source records them', () => {
    expect(elementsOf(ecluse).filter((element) => element.outOfScope)).toEqual(
      [],
    );
  });

  it('keeps the gapped threat numbering, 19 absent and 101 and 102 apart', () => {
    expect(new Set(ecluse.threats.map((threat) => threat.number))).toEqual(
      new Set([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21,
        22, 23, 24, 25, 26, 27, 28, 101, 102,
      ]),
    );
  });

  it('issues up to 102, the greater of threatTop 28 and its own highest', () => {
    expect(ecluse.lastIssuedThreatNumber).toBe(102);
  });

  it('records the three statuses the source uses', () => {
    expect(tally(ecluse.threats.map((threat) => threat.status))).toEqual({
      mitigated: 19,
      open: 7,
      'accepted-risk': 3,
    });
  });

  it('records the four severities the source uses', () => {
    expect(tally(ecluse.threats.map((threat) => threat.severity))).toEqual({
      high: 14,
      medium: 12,
      low: 2,
      critical: 1,
    });
  });

  it('records all six STRIDE categories and no other methodology', () => {
    expect(
      new Set(ecluse.threats.map((threat) => threat.category.methodology)),
    ).toEqual(new Set(['STRIDE']));
    expect(
      tally(ecluse.threats.map((threat) => threat.category.category)),
    ).toEqual({
      'elevation-of-privilege': 7,
      tampering: 6,
      'denial-of-service': 6,
      'information-disclosure': 5,
      spoofing: 4,
      repudiation: 1,
    });
  });

  it('attaches its 29 threats across 13 of the 38 elements', () => {
    expect(ecluse.threats).toHaveLength(29);
    expect(
      new Set(ecluse.threats.flatMap((threat) => threat.elements)).size,
    ).toBe(13);
  });
});

describe('the coverage queries over the Écluse model', () => {
  it('names the 25 elements no threat reaches', () => {
    expect(elementsWithoutThreats(ecluse)).toHaveLength(25);
  });

  it('groups the seven open threats by severity', () => {
    const grouped = openThreatsBySeverity(ecluse);
    expect({
      low: grouped.low.length,
      medium: grouped.medium.length,
      high: grouped.high.length,
      critical: grouped.critical.length,
      tbd: grouped.tbd.length,
    }).toEqual({ low: 0, medium: 4, high: 2, critical: 1, tbd: 0 });
  });

  it('counts the threats on every element, five on the Dredger', () => {
    const counts = threatCountByElement(ecluse);
    expect(counts.size).toBe(38);
    expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(
      29,
    );
    expect(counts.get(elementId('f66e2ffa-c6bf-4b45-8aad-a23ced3a97ff'))).toBe(
      5,
    );
  });
});

describe('vocabularyComplementFixture', () => {
  it('parses through parseModel', () => {
    expect(issuesOf(vocabularyComplementFixture)).toEqual([]);
  });

  it('draws the curve boundary the Écluse model has no example of', () => {
    expect(
      boundariesOf(complement).map((boundary) => boundary.shape.kind),
    ).toEqual(['curve']);
  });

  it('holds an out-of-scope element carrying its reason', () => {
    expect(
      elementsOf(complement)
        .filter((element) => element.outOfScope)
        .map((element) => element.reasonOutOfScope),
    ).toEqual(['Held and operated by the records department.']);
  });

  it('credits a longer contributor list than the Écluse model names', () => {
    expect(complement.metadata.contributors).toEqual([
      'Alexandra de Wit',
      'Jonas Lindqvist',
    ]);
  });

  it('carries the tbd severity and the not-applicable status', () => {
    expect(complement.threats.map((threat) => threat.severity)).toContain(
      'tbd',
    );
    expect(complement.threats.map((threat) => threat.status)).toContain(
      'not-applicable',
    );
  });
});

describe('the two fixtures together', () => {
  it('reach every element kind', () => {
    expect(
      spanning((model) => elementsOf(model).map((element) => element.kind)),
    ).toEqual(
      new Set(elementSchema.options.map((option) => option.shape.kind.value)),
    );
  });

  it('reach both trust boundary shapes', () => {
    expect(
      spanning((model) =>
        boundariesOf(model).map((boundary) => boundary.shape.kind),
      ),
    ).toEqual(
      new Set(
        boundaryShapeSchema.options.map((option) => option.shape.kind.value),
      ),
    );
  });

  it('reach both flow endpoint kinds', () => {
    expect(
      spanning((model) =>
        flowsOf(model).flatMap((flow) => [flow.source.kind, flow.target.kind]),
      ),
    ).toEqual(
      new Set(
        flowEndpointSchema.options.map((option) => option.shape.kind.value),
      ),
    );
  });

  it('reach every threat status', () => {
    expect(
      spanning((model) => model.threats.map((threat) => threat.status)),
    ).toEqual(new Set(threatStatusSchema.options));
  });

  it('reach every severity', () => {
    expect(
      spanning((model) => model.threats.map((threat) => threat.severity)),
    ).toEqual(new Set(severitySchema.options));
  });

  it('reach every methodology', () => {
    expect(
      spanning((model) =>
        model.threats.map((threat) => threat.category.methodology),
      ),
    ).toEqual(
      new Set(
        threatCategorySchema.options.map(
          (option) => option.shape.methodology.value,
        ),
      ),
    );
  });

  it('draw a category vocabulary from every methodology but the custom one', () => {
    expect(enumeratedCategories.map(([methodology]) => methodology)).toEqual(
      threatCategorySchema.options
        .map((option) => option.shape.methodology.value)
        .filter((methodology) => methodology !== 'custom'),
    );
  });

  it.each(enumeratedCategories)(
    'reach every %s category',
    (methodology, categories) => {
      expect(spanning(categoriesUnder(methodology))).toEqual(
        new Set(categories),
      );
    },
  );

  it('reach every mitigation status', () => {
    expect(
      spanning((model) =>
        model.mitigations.map((mitigation) => mitigation.status),
      ),
    ).toEqual(new Set(mitigationStatusSchema.options));
  });

  it('reach both assumption statuses', () => {
    expect(
      spanning((model) =>
        model.assumptions.map((assumption) => assumption.status),
      ),
    ).toEqual(new Set(assumptionStatusSchema.options));
  });
});
