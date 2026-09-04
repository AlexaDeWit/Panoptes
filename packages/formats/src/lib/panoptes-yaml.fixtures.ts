import {
  acceptedTextSchema,
  assumptionSchema,
  assumptionStatusSchema,
  diagramSchema,
  elementSchema,
  flowEndpointSchema,
  mitigationSchema,
  mitigationStatusSchema,
  modelMetadataSchema,
  severitySchema,
  threatCategorySchema,
  threatSchema,
  threatStatusSchema,
  type Model,
  type ThreatCategory,
} from '@panoptes/model';
import { Either } from 'effect';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { readThreatDragon } from './threat-dragon-read.js';
import { ecluseText } from './threat-dragon.fixtures.js';

const repositoryRoot = join(import.meta.dirname, '../../../..');

/**
 * The Écluse model, read from the Threat Dragon file the repository
 * vendors, which is the only production-scale model the project has. The
 * Threat Dragon corpus spec is what gates that the file reads at all, so a
 * failure here needs no message of its own.
 */
export const ecluseModel: Model = Either.getOrThrow(
  readThreatDragon(ecluseText),
).model;

/**
 * The Écluse model as this format writes it, committed so a change to what
 * the format writes arrives as a diff on a file rather than as a test that
 * still passes.
 */
export const goldenPath: string = join(
  repositoryRoot,
  'test-data/panoptes/ecluse.yaml',
);

const panoptesModelPath = join(
  repositoryRoot,
  'threat-modelling/panoptes.yaml',
);

const panoptesModelJsonPath = join(
  repositoryRoot,
  'test-data/panoptes.model.json',
);

/**
 * A Panoptes YAML file this repository commits, with its committed bytes and,
 * where this suite is the producer of one, the path it writes the file's
 * internal model out to.
 */
export type NativeFixture = {
  readonly name: string;
  readonly path: string;
  readonly text: string;
  readonly modelJsonPath: string | undefined;
};

/** A {@link NativeFixture} whose internal model this suite writes out. */
export type EmittedModel = {
  readonly name: string;
  readonly text: string;
  readonly modelJsonPath: string;
};

/**
 * Every Panoptes YAML file this repository commits. Each is a fixed point of
 * the codec: what a read of the committed bytes writes back is those bytes
 * again. The suites that gate a native file read this list rather than a
 * path, so a third file joins all of them by being added here.
 *
 * `modelJsonPath` is where a file's internal model is written out for
 * `packages/render` and `packages/canvas`, which gate on a model and cannot
 * import a codec. Écluse names none, because `packages/model` writes that
 * one from its own transcription of the Threat Dragon file and this suite
 * compares against it rather than producing it. A file this suite is the
 * only reader of names its own.
 */
export const nativeFixtures: readonly NativeFixture[] = [
  {
    name: 'Écluse model',
    path: goldenPath,
    text: readFileSync(goldenPath, 'utf8'),
    modelJsonPath: undefined,
  },
  {
    name: 'Panoptes model',
    path: panoptesModelPath,
    text: readFileSync(panoptesModelPath, 'utf8'),
    modelJsonPath: panoptesModelJsonPath,
  },
];

/** The fixtures of {@link nativeFixtures} this suite writes a model out for. */
export const emittedModels: readonly EmittedModel[] = nativeFixtures.flatMap(
  (fixture) =>
    fixture.modelJsonPath === undefined
      ? []
      : [
          {
            name: fixture.name,
            text: fixture.text,
            modelJsonPath: fixture.modelJsonPath,
          },
        ],
);

type ElementInput = z.input<typeof elementSchema>;
type ElementKind = ElementInput['kind'];
type EndpointInput = z.input<typeof flowEndpointSchema>;
type ThreatInput = z.input<typeof threatSchema>;
type DiagramInput = z.input<typeof diagramSchema>;
type MitigationInput = z.input<typeof mitigationSchema>;
type AssumptionInput = z.input<typeof assumptionSchema>;
type MetadataInput = z.input<typeof modelMetadataSchema>;

const elementKinds: readonly ElementKind[] = elementSchema.options.map(
  (option) => option.shape.kind.value,
);

const awkwardText = [
  '',
  ' leading space',
  'trailing space ',
  'two\nlines',
  '# hash',
  '- dash',
  'key: value',
  'null',
  '42',
  '"quoted"',
  'tab\there',
];

const acceptedByTheModel = (text: string): boolean =>
  acceptedTextSchema.safeParse(text).success;

const textArbitrary = fc
  .oneof(
    fc.string(),
    fc.string({ unit: 'grapheme' }),
    fc.constantFrom(...awkwardText),
  )
  .filter(acceptedByTheModel);

const namedTextArbitrary = fc
  .oneof(
    fc.string({ minLength: 1 }),
    fc.constantFrom(...awkwardText.filter((text) => text.length > 0)),
  )
  .filter(acceptedByTheModel);

const coordinateArbitrary = fc
  .double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true })
  .filter((value) => !Object.is(value, -0));

const extentArbitrary = fc
  .double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true })
  .filter((value) => value > 0);

const pointArbitrary = fc.record({
  x: coordinateArbitrary,
  y: coordinateArbitrary,
});

const sizeArbitrary = fc.record({
  width: extentArbitrary,
  height: extentArbitrary,
});

type CategoryVariant = (typeof threatCategorySchema)['options'][number];

const categoryArbitrary: fc.Arbitrary<ThreatCategory> = fc
  .oneof(...threatCategorySchema.options.map(categoryCandidatesOf))
  .map((candidate) => threatCategorySchema.parse(candidate));

function categoryCandidatesOf(
  variant: CategoryVariant,
): fc.Arbitrary<Record<string, string>> {
  const methodology = variant.shape.methodology.value;
  return 'options' in variant.shape.category
    ? fc.record({
        methodology: fc.constant(methodology),
        category: fc.constantFrom(...variant.shape.category.options),
      })
    : fc.record({
        methodology: fc.constant(methodology),
        methodologyName: namedTextArbitrary,
        category: namedTextArbitrary,
      });
}

const metadataArbitrary: fc.Arbitrary<MetadataInput> = fc.record({
  title: textArbitrary,
  owner: textArbitrary,
  description: textArbitrary,
  contributors: fc.array(textArbitrary, { maxLength: 3 }),
});

const threatNumbersArbitrary = fc
  .uniqueArray(fc.integer({ min: 1, max: 999 }), { maxLength: 5 })
  .filter((numbers) => numbers.length < 2 || !isAscending(numbers));

/**
 * Models covering every record kind the internal model has, as `parseModel`
 * input rather than as models: a spec parses them, so a generator that
 * strays outside what the model accepts fails the run that produced it
 * rather than passing quietly. Text is drawn through the model's own
 * character rule for that reason, the grapheme unit reaching a private use
 * or format character now and again.
 *
 * Categories are read from the union rather than listed, so a methodology
 * added there is generated without an edit here, and each candidate is
 * built loosely and handed back through the schema, which is what pairs a
 * methodology with its own categories again. Threat numbers are distinct
 * and never already ascending where there is more than one, so a model
 * reaches the write in an order the write has to change rather than one it
 * can leave alone.
 *
 * Ids are positional, so uniqueness across the model comes free and the
 * references, which are drawn from the ids already laid out, always resolve.
 * A flow's endpoints are drawn from its own diagram, minus the flow, which
 * is what `parseModel` demands of them.
 */
export const modelInputArbitrary = fc
  .record({
    layout: fc.array(
      fc.array(fc.constantFrom(...elementKinds), {
        maxLength: 4,
      }),
      { maxLength: 3 },
    ),
    threatNumbers: threatNumbersArbitrary,
    mitigationCount: fc.integer({ min: 0, max: 2 }),
    assumptionCount: fc.integer({ min: 0, max: 2 }),
    headroom: fc.integer({ min: 0, max: 20 }),
  })
  .chain((plan) => {
    const elementIds = plan.layout.map((kinds, diagram) =>
      kinds.map((_, element) => `element-${diagram}-${element}`),
    );
    const allElementIds = elementIds.flat();
    const threatIds = plan.threatNumbers.map((_, index) => `threat-${index}`);
    return fc.record({
      metadata: metadataArbitrary,
      diagrams: fc.tuple(
        ...plan.layout.map((kinds, diagram) =>
          diagramArbitrary(`diagram-${diagram}`, kinds, elementIds[diagram]),
        ),
      ),
      threats: fc.tuple(
        ...plan.threatNumbers.map((number, index) =>
          threatArbitrary(threatIds[index], number, allElementIds),
        ),
      ),
      lastIssuedThreatNumber: fc.constant(
        Math.max(0, ...plan.threatNumbers) + plan.headroom,
      ),
      mitigations: fc.tuple(
        ...countTo(plan.mitigationCount).map((index) =>
          mitigationArbitrary(`mitigation-${index}`, threatIds),
        ),
      ),
      assumptions: fc.tuple(
        ...countTo(plan.assumptionCount).map((index) =>
          assumptionArbitrary(`assumption-${index}`, allElementIds, threatIds),
        ),
      ),
    });
  });

function diagramArbitrary(
  id: string,
  kinds: readonly ElementKind[],
  ids: readonly string[],
): fc.Arbitrary<DiagramInput> {
  return fc.record({
    id: fc.constant(id),
    title: fc.constant(id),
    elements: fc.tuple(
      ...kinds.map((kind, index) =>
        elementArbitrary(
          kind,
          ids[index],
          ids.filter((sibling) => sibling !== ids[index]),
        ),
      ),
    ),
  });
}

function elementArbitrary(
  kind: ElementKind,
  id: string,
  siblings: readonly string[],
): fc.Arbitrary<ElementInput> {
  if (kind === 'flow') {
    return fc
      .tuple(
        commonArbitrary(id),
        endpointArbitrary(siblings),
        endpointArbitrary(siblings),
        fc.array(pointArbitrary, { maxLength: 3 }),
      )
      .map(([common, source, target, waypoints]) => ({
        kind,
        ...common,
        source,
        target,
        waypoints,
      }));
  }
  if (kind === 'trust-boundary') {
    return fc
      .tuple(commonArbitrary(id), boundaryShapeArbitrary)
      .map(([common, shape]) => ({ kind, ...common, shape }));
  }
  if (kind === 'text') {
    return fc
      .tuple(commonArbitrary(id), pointArbitrary, sizeArbitrary, textArbitrary)
      .map(([common, position, size, text]) => ({
        kind,
        ...common,
        position,
        size,
        text,
      }));
  }
  return fc
    .tuple(commonArbitrary(id), pointArbitrary, sizeArbitrary)
    .map(([common, position, size]) => ({ kind, ...common, position, size }));
}

function commonArbitrary(id: string) {
  return fc.record({
    id: fc.constant(id),
    name: textArbitrary,
    description: textArbitrary,
    outOfScope: fc.boolean(),
    reasonOutOfScope: textArbitrary,
  });
}

function endpointArbitrary(
  siblings: readonly string[],
): fc.Arbitrary<EndpointInput> {
  const free = fc.record({
    kind: fc.constant('free' as const),
    position: pointArbitrary,
  });
  return siblings.length === 0
    ? free
    : fc.oneof(
        free,
        fc.record({
          kind: fc.constant('attached' as const),
          element: fc.constantFrom(...siblings),
        }),
      );
}

const boundaryShapeArbitrary = fc.oneof(
  fc.record({
    kind: fc.constant('box' as const),
    position: pointArbitrary,
    size: sizeArbitrary,
  }),
  fc.record({
    kind: fc.constant('curve' as const),
    waypoints: fc.array(pointArbitrary, { minLength: 2, maxLength: 4 }),
  }),
);

function threatArbitrary(
  id: string,
  number: number,
  elementIds: readonly string[],
): fc.Arbitrary<ThreatInput> {
  return fc.record({
    id: fc.constant(id),
    number: fc.constant(number),
    title: textArbitrary,
    category: categoryArbitrary,
    severity: fc.constantFrom(...severitySchema.options),
    status: fc.constantFrom(...threatStatusSchema.options),
    description: textArbitrary,
    mitigation: textArbitrary,
    elements: fc.subarray([...elementIds]),
  });
}

function mitigationArbitrary(
  id: string,
  threatIds: readonly string[],
): fc.Arbitrary<MitigationInput> {
  return fc.record({
    id: fc.constant(id),
    title: textArbitrary,
    prose: textArbitrary,
    status: fc.constantFrom(...mitigationStatusSchema.options),
    threats: fc.subarray([...threatIds]),
  });
}

function assumptionArbitrary(
  id: string,
  elementIds: readonly string[],
  threatIds: readonly string[],
): fc.Arbitrary<AssumptionInput> {
  return fc.record({
    id: fc.constant(id),
    prose: textArbitrary,
    status: fc.constantFrom(...assumptionStatusSchema.options),
    elements: fc.subarray([...elementIds]),
    threats: fc.subarray([...threatIds]),
  });
}

function countTo(total: number): number[] {
  return [...Array(total).keys()];
}

function isAscending(numbers: readonly number[]): boolean {
  return numbers.every(
    (number, index) => index === 0 || numbers[index - 1] < number,
  );
}
