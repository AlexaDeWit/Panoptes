import { parseModel, type Model } from '@panoptes/model';
import { panoptesYamlWireSchema } from '@panoptes/wire-panoptes-yaml';
import { Either } from 'effect';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { panoptesYamlCodec } from './panoptes-yaml.js';
import {
  ecluseModel,
  emittedModels,
  goldenPath,
  modelInputArbitrary,
  nativeFixtures,
} from './panoptes-yaml.fixtures.js';

const golden = readFileSync(goldenPath, 'utf8');

const description = readFileSync(
  join(import.meta.dirname, '../../../../docs/panoptes-yaml.md'),
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
  return Either.getOrThrow(panoptesYamlCodec.read(text));
}

describe('the Panoptes YAML codec', () => {
  it('pairs the read and the write with the schema they share', () => {
    expect(panoptesYamlCodec.wire).toBe(panoptesYamlWireSchema);
  });

  it('reads the committed fixture as the model it was written from', () => {
    const reading = readOrThrow(golden);
    expect(reading.model).toEqual(inNumberOrder(ecluseModel));
    expect(reading.divergences).toEqual([]);
  });

  it('wrote the example the format description prints, to the byte', () => {
    const reading = readOrThrow(documentedExample);
    expect(reading.divergences).toEqual([]);
    expect(panoptesYamlCodec.write(reading.model).output).toBe(
      documentedExample,
    );
  });

  it('hands back the document it read, for a write to merge onto', () => {
    expect(readOrThrow(golden).source.formatVersion).toBe(1);
  });
});

describe.each(nativeFixtures)('the committed $name', ({ path, text }) => {
  it('reads with nothing diverging, and writes back the bytes committed', async () => {
    const reading = readOrThrow(text);
    expect(reading.divergences).toEqual([]);
    await expect(
      panoptesYamlCodec.write(reading.model).output,
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

describe('any model at all', () => {
  it('survives a write and a read as itself, threats in number order', () => {
    fc.assert(
      fc.property(modelInputArbitrary, (input) => {
        const model = Either.getOrThrow(parseModel(input));
        const written = panoptesYamlCodec.write(model);
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
        const output = panoptesYamlCodec.write(
          Either.getOrThrow(parseModel(input)),
        ).output;
        expect(panoptesYamlCodec.write(readOrThrow(output).model).output).toBe(
          output,
        );
      }),
    );
  });
});
