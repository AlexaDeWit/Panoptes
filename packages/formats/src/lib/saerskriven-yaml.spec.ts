import {
  parseModel,
  type Flow,
  type FlowEndpoint,
  type Model,
} from '@saerskriven/model';
import { modelInputArbitrary } from '@saerskriven/model/fixtures';
import { saerskrivenYamlWireSchema } from '@saerskriven/wire-saerskriven-yaml';
import { Either } from 'effect';
import * as fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import {
  ecluseModel,
  emittedModels,
  frozenV021Path,
  goldenPath,
  nativeFixtures,
  propertyTimeout,
} from './saerskriven-yaml.fixtures.js';

const golden = readFileSync(goldenPath, 'utf8');

const frozenV021 = readFileSync(frozenV021Path, 'utf8');

const description = readFileSync(
  join(import.meta.dirname, '../../../../docs/saerskriven-yaml.md'),
  'utf8',
);

const fence = '```yaml\n';

const exampleStart = description.indexOf(fence) + fence.length;

const documentedExample = description.slice(
  exampleStart,
  description.indexOf('```', exampleStart),
);

function inNumberOrder(model: Model): Model {
  const threats = [...model.threats];
  threats.sort((left, right) => left.number - right.number);
  return { ...model, threats };
}

function readOrThrow(text: string) {
  return Either.getOrThrow(saerskrivenYamlCodec.read(text));
}

function withoutPinnedSides(model: Model): Model {
  return {
    ...model,
    diagrams: model.diagrams.map((diagram) => ({
      ...diagram,
      elements: diagram.elements.map((element) =>
        element.kind === 'flow'
          ? {
              ...element,
              source: unpinned(element.source),
              target: unpinned(element.target),
            }
          : element,
      ),
    })),
  };
}

function unpinned(endpoint: FlowEndpoint): FlowEndpoint {
  return endpoint.kind === 'attached'
    ? { kind: 'attached', element: endpoint.element }
    : endpoint;
}

function flowsOf(model: Model): readonly Flow[] {
  return model.diagrams.flatMap((diagram) =>
    diagram.elements.flatMap((element) =>
      element.kind === 'flow' ? [element] : [],
    ),
  );
}

describe('the Saerskriven YAML codec', () => {
  it('pairs the read and the write with the schema they share', () => {
    expect(saerskrivenYamlCodec.wire).toBe(saerskrivenYamlWireSchema);
  });

  it('reads the committed fixture as the model it was written from', () => {
    const reading = readOrThrow(golden);
    expect(reading.model).toEqual(inNumberOrder(ecluseModel));
    expect(reading.divergences).toEqual([]);
  });

  it('wrote the example the format description prints, to the byte', () => {
    const reading = readOrThrow(documentedExample);
    expect(reading.divergences).toEqual([]);
    expect(saerskrivenYamlCodec.write(reading.model).output).toBe(
      documentedExample,
    );
  });

  it('hands back the document it read, for a write to merge onto', () => {
    expect(readOrThrow(golden).source.formatVersion).toBe(1);
  });
});

describe('the document shape v0.2.1 wrote', () => {
  it('reads as the model it describes, with nothing diverging', () => {
    const reading = readOrThrow(frozenV021);
    expect(reading.divergences).toEqual([]);
    const legacy = withoutPinnedSides(inNumberOrder(ecluseModel));
    const diagrams = legacy.diagrams.map((diagram) => ({
      ...diagram,
      elements: diagram.elements.map((element) =>
        Object.fromEntries(
          Object.entries(element).filter(
            ([key]) =>
              ![
                'providesAuthentication',
                'handlesCardPayment',
                'handlesGoodsOrServices',
                'isWebApplication',
                'privilegeLevel',
                'isALog',
                'isEncrypted',
                'isSigned',
                'storesCredentials',
                'storesInventory',
                'protocol',
                'isPublicNetwork',
                'trustBoundaryIds',
                'containedElements',
                'crossingFlows',
              ].includes(key),
          ),
        ),
      ),
    }));
    expect(reading.model).toEqual({ ...legacy, diagrams });
  });

  it('takes every flow as one-way and every attached end as unpinned', () => {
    const flows = flowsOf(readOrThrow(frozenV021).model);
    expect(flows).toHaveLength(20);
    expect(flows.filter((flow) => flow.bidirectional)).toEqual([]);
    expect(
      flows
        .flatMap((flow) => [flow.source, flow.target])
        .filter(
          (endpoint) =>
            endpoint.kind === 'attached' && endpoint.side !== undefined,
        ),
    ).toEqual([]);
  });
});

describe.each(nativeFixtures)('the committed $name', ({ path, text }) => {
  it('reads with nothing diverging, and writes back the bytes committed', async () => {
    const reading = readOrThrow(text);
    expect(reading.divergences).toEqual([]);
    await expect(
      saerskrivenYamlCodec.write(reading.model).output,
    ).toMatchFileSnapshot(path);
  });
});

describe.each(emittedModels)(
  'the internal model of the $name',
  ({ text, modelJsonPath }) => {
    it('is written out for the render and canvas suites to read', async () => {
      await expect(
        `${JSON.stringify(readOrThrow(text).model, null, 2)}\n`,
      ).toMatchFileSnapshot(modelJsonPath);
    });
  },
);

describe(
  'any model at all',
  () => {
    it('survives a write and a read as itself, threats in number order', () => {
      fc.assert(
        fc.property(modelInputArbitrary, (input) => {
          const model = Either.getOrThrow(parseModel(input));
          const written = saerskrivenYamlCodec.write(model);
          expect(written.divergences).toEqual([]);
          const reading = readOrThrow(written.output);
          expect(reading.divergences).toEqual([]);
          expect(reading.model).toEqual(inNumberOrder(model));
        }),
      );
    });

    it('writes the same bytes however its records were built', () => {
      fc.assert(
        fc.property(modelInputArbitrary, (input) => {
          const output = saerskrivenYamlCodec.write(
            Either.getOrThrow(parseModel(input)),
          ).output;
          expect(
            saerskrivenYamlCodec.write(readOrThrow(output).model).output,
          ).toBe(output);
        }),
      );
    });
  },
  propertyTimeout,
);
