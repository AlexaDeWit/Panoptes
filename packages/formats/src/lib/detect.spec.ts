import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ReadFailure } from './codec.js';
import {
  DetectionFailure,
  formatNameSchema,
  readAnyFormat,
  type DetectedRead,
} from './detect.js';
import { goldenPath } from './panoptes-yaml.fixtures.js';
import { panoptesYamlCodec } from './panoptes-yaml.js';
import { readPanoptesYaml } from './panoptes-yaml-read.js';
import { readLimits } from './read-limits.js';
import { corpusTexts, ecluseText } from './threat-dragon.fixtures.js';
import { threatDragonCodec } from './threat-dragon.js';

const nativeText = readFileSync(goldenPath, 'utf8');

const branchingCycle = readFileSync(
  join(
    import.meta.dirname,
    '../../../../test-data/adversarial/branching-cycle.yaml',
  ),
  'utf8',
);

const nativeMinimal = `formatVersion: 1
metadata:
  title: Minimal
  owner: ""
  description: ""
  contributors: []
assumptions: []
diagrams: []
mitigations: []
threats: []
lastIssuedThreatNumber: 0
`;

const laterFormatVersion = nativeMinimal.replace(
  'formatVersion: 1',
  'formatVersion: 2',
);

const danglingReference = `formatVersion: 1
metadata:
  title: Dangling
  owner: ""
  description: ""
  contributors: []
assumptions: []
diagrams: []
mitigations: []
threats:
  - id: threat-1
    number: 1
    title: Spoofed caller
    category:
      methodology: STRIDE
      category: spoofing
    severity: high
    status: open
    description: ""
    mitigation: ""
    elements:
      - element-1
lastIssuedThreatNumber: 1
`;

const threatDragonMinimal =
  '{"version":"2.6.2","summary":{"title":"Minimal"},"detail":{"diagrams":[]}}';

const laterMajor = threatDragonMinimal.replace('2.6.2', '3.0.0');

const refusedCell =
  '{"version":"2.6.2","summary":{"title":"Refused"},"detail":{"diagrams":[{"id":0,"title":"Level 0","diagramType":"STRIDE","cells":[{"id":"a","shape":"process","position":{"x":0,"y":0},"size":{"width":10,"height":10},"data":{"type":"tm.Process"}}]}]}}';

const nativeAsJson = JSON.stringify(
  Either.getOrThrow(panoptesYamlCodec.read(nativeText)).source,
);

const unclaimed: readonly { name: string; text: string }[] = [
  { name: 'prose', text: 'Notes towards a threat model. Nothing formal yet.' },
  { name: 'nothing at all', text: '' },
  { name: 'a JSON object with none of the root keys', text: '{"hello":"you"}' },
  { name: 'a YAML mapping with no formatVersion', text: 'metadata:\n  a: b\n' },
  {
    name: 'another tool stamping a version inside major 2',
    text: '{"version":"2.0","name":"some other tool"}',
  },
  {
    name: 'a version inside major 2 and a summary, but no detail',
    text: '{"version":"2.0","summary":{"title":"Some other tool"}}',
  },
  {
    name: 'a version 2.6.2 document with a detail, but no summary',
    text: '{"version":"2.6.2","detail":{"diagrams":[]}}',
  },
];

const opened = (text: string): DetectedRead =>
  Either.getOrThrow(readAnyFormat(text));

const outcome = (text: string) => Either.merge(readAnyFormat(text));

const issuePaths = (given: unknown): readonly string[] =>
  ReadFailure.$is('InvalidWireDocument')(given) ||
  ReadFailure.$is('InvalidModel')(given)
    ? given.issues.map((issue) => issue.path.join('.'))
    : [];

function writtenAsPanoptesYaml(answer: DetectedRead): string {
  if (answer.format === 'threat-dragon') {
    return panoptesYamlCodec.write(
      answer.model,
      // @ts-expect-error a Threat Dragon document is no Panoptes YAML document
      answer.source,
    ).output;
  }
  return answer.codec.write(answer.model, answer.source).output;
}

function rewritten(answer: DetectedRead): {
  readonly stamp: string | number;
  readonly output: string;
} {
  if (answer.format === 'threat-dragon') {
    return {
      stamp: answer.source.version,
      output: answer.codec.write(answer.model, answer.source).output,
    };
  }
  return {
    stamp: answer.source.formatVersion,
    output: answer.codec.write(answer.model, answer.source).output,
  };
}

describe('opening a text without being told its format', () => {
  it('reads the Écluse file as Threat Dragon', () => {
    const answer = opened(ecluseText);
    expect(answer.format).toBe('threat-dragon');
    expect(answer.codec).toBe(threatDragonCodec);
  });

  it('reads the native file as Panoptes YAML', () => {
    const answer = opened(nativeText);
    expect(answer.format).toBe('panoptes-yaml');
    expect(answer.codec).toBe(panoptesYamlCodec);
  });

  it.each(corpusTexts)('reads $name as Threat Dragon', ({ text }) => {
    expect(opened(text).format).toBe('threat-dragon');
  });

  it('reads a Panoptes model saved as JSON as Panoptes YAML', () => {
    expect(opened(nativeAsJson).format).toBe('panoptes-yaml');
  });

  it('hands back everything the codec that answered produced', () => {
    const answer = opened(nativeText);
    expect(answer.model).toEqual(
      Either.getOrThrow(readPanoptesYaml(nativeText)).model,
    );
    expect(answer.divergences).toEqual([]);
  });
});

describe('a file of one format offered to the other codec', () => {
  it('is not JSON, so the Threat Dragon codec refuses the native file', () => {
    const reading = threatDragonCodec.read(nativeText);
    expect(Either.isLeft(reading)).toBe(true);
    expect(Either.merge(reading)).toMatchObject({ _tag: 'MalformedText' });
  });

  it('is JSON all the same, so the Threat Dragon codec refuses it by key', () => {
    const refused = Either.merge(threatDragonCodec.read(nativeAsJson));
    expect(refused).toMatchObject({ _tag: 'InvalidWireDocument' });
    expect(issuePaths(refused)).toEqual(['version', 'summary', 'detail']);
  });

  it('is YAML, so the Panoptes codec refuses the Écluse file at its stamp', () => {
    const refused = Either.merge(panoptesYamlCodec.read(ecluseText));
    expect(refused).toMatchObject({ _tag: 'InvalidWireDocument' });
    expect(issuePaths(refused)).toContain('formatVersion');
  });
});

describe('a text no codec claims', () => {
  it.each(unclaimed)('names every format tried for $name', ({ text }) => {
    expect(outcome(text)).toEqual(
      DetectionFailure.NoFormatClaimed({ tried: formatNameSchema.options }),
    );
  });

  it('tries Threat Dragon first and Panoptes YAML second', () => {
    expect(outcome('{"hello":"you"}')).toEqual(
      DetectionFailure.NoFormatClaimed({
        tried: ['threat-dragon', 'panoptes-yaml'],
      }),
    );
  });
});

describe('a text past a read limit', () => {
  it('answers with the bound rather than with what detection tried', () => {
    expect(outcome(branchingCycle)).toMatchObject({
      _tag: 'ExceededReadLimit',
      limit: 'maxAliasCount',
    });
  });

  it('stops at the first codec to meet it, offering the text to no other', () => {
    expect(outcome('a'.repeat(readLimits.maxTextBytes + 1))).toMatchObject({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
    });
  });
});

describe('a file a codec claimed and then refused', () => {
  it('reports a dangling reference as the Panoptes mapping refusing it', () => {
    const failure = outcome(danglingReference);
    expect(failure).toMatchObject({ _tag: 'InvalidModel' });
    expect(issuePaths(failure)).toContain('threats.0.elements.0');
  });

  it('reports a cell the wire schema refuses with a path into the file', () => {
    const failure = outcome(refusedCell);
    expect(failure).toMatchObject({ _tag: 'InvalidWireDocument' });
    expect(issuePaths(failure)).toContain('detail.diagrams.0.cells.0.id');
  });
});

describe('a file from a release neither codec models', () => {
  it('opens the smallest file of each release they do model', () => {
    expect(opened(threatDragonMinimal).format).toBe('threat-dragon');
    expect(opened(nativeMinimal).format).toBe('panoptes-yaml');
  });

  it('claims no Threat Dragon file from a major above 2', () => {
    expect(outcome(laterMajor)).toEqual(
      DetectionFailure.NoFormatClaimed({ tried: formatNameSchema.options }),
    );
  });

  it('claims no Panoptes file stamped other than 1', () => {
    expect(outcome(laterFormatVersion)).toEqual(
      DetectionFailure.NoFormatClaimed({ tried: formatNameSchema.options }),
    );
  });
});

describe('the codec the result carries', () => {
  it.each([
    { name: 'the Écluse file', text: ecluseText, stamp: '2.6.2' },
    { name: 'the native file', text: nativeText, stamp: 1 },
  ])('writes $name back as the format that answered', ({ text, stamp }) => {
    const answer = opened(text);
    const written = rewritten(answer);
    expect(written.stamp).toBe(stamp);
    const again = opened(written.output);
    expect(again.format).toBe(answer.format);
    expect(again.model).toEqual(answer.model);
  });

  it('refuses at compile time what nothing refuses at run time', () => {
    expect(opened(writtenAsPanoptesYaml(opened(ecluseText))).format).toBe(
      'panoptes-yaml',
    );
  });
});
