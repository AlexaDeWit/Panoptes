import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, parseDocument } from 'yaml';
import type { ReadFailure } from './codec.js';
import { aliasCostIn } from './panoptes-yaml-document.js';
import { readPanoptesYaml } from './panoptes-yaml-read.js';
import { nativeFixtures } from './panoptes-yaml.fixtures.js';
import { parseWithinLimits, readLimits } from './read-limits.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { corpusTexts } from './threat-dragon.fixtures.js';

type Read = (text: string) => Either.Either<unknown, ReadFailure>;

const adversarial = join(
  import.meta.dirname,
  '../../../../test-data/adversarial',
);

const vendored = (name: string): string =>
  readFileSync(join(adversarial, name), 'utf8');

const nestedBy = (steps: number): string =>
  `${'['.repeat(steps + 1)}${']'.repeat(steps + 1)}`;

const sharedFromDepths = (elements: number, depths: number): string =>
  [
    `shared: &shared [${'x,'.repeat(elements - 1)}x]`,
    'deep:',
    ...Array.from(
      { length: depths },
      (_, step) =>
        `${' '.repeat(step + 1)}at: *shared\n${' '.repeat(step + 1)}in:`,
    ),
    `${' '.repeat(depths + 1)}end: done`,
    '',
  ].join('\n');

const nestedAnchors = (anchors: number): string => {
  const named = Array.from({ length: anchors }, (_, step) => step + 1);
  return [
    ...named.map((step) => `n${String(step)}: &n${String(step)} x`),
    'nest: &c1',
    ...named
      .slice(1)
      .map((step) => `${' '.repeat(step - 1)}in: &c${String(step)}`),
    `${' '.repeat(anchors)}[${named.map((step) => `*n${String(step)}`).join(', ')}]`,
    `use: [${named.map((step) => `*c${String(step)}`).join(', ')}]`,
    '',
  ].join('\n');
};

const fixtures: readonly {
  readonly name: string;
  readonly text: string;
  readonly asYaml: string;
  readonly asJson: string;
}[] = [
  {
    name: 'deep-nesting.json',
    text: vendored('deep-nesting.json'),
    asYaml: 'maxNestingDepth',
    asJson: 'maxNestingDepth',
  },
  {
    name: 'deep-block.yaml',
    text: vendored('deep-block.yaml'),
    asYaml: 'maxNestingDepth',
    asJson: 'MalformedText',
  },
  {
    name: 'cyclic-anchor.yaml',
    text: vendored('cyclic-anchor.yaml'),
    asYaml: 'maxAliasCount',
    asJson: 'MalformedText',
  },
  {
    name: 'alias-expansion.yaml',
    text: vendored('alias-expansion.yaml'),
    asYaml: 'maxAliasCount',
    asJson: 'MalformedText',
  },
  {
    name: 'branching-cycle.yaml',
    text: vendored('branching-cycle.yaml'),
    asYaml: 'maxAliasCount',
    asJson: 'MalformedText',
  },
  {
    name: 'wide-cycle.yaml',
    text: vendored('wide-cycle.yaml'),
    asYaml: 'maxAliasCount',
    asJson: 'MalformedText',
  },
  {
    name: 'shared-anchor.yaml',
    text: vendored('shared-anchor.yaml'),
    asYaml: 'maxAliasExpansion',
    asJson: 'MalformedText',
  },
  {
    name: 'nested-anchors.yaml',
    text: vendored('nested-anchors.yaml'),
    asYaml: 'maxAliasCount',
    asJson: 'MalformedText',
  },
  {
    name: 'a branching cycle written as a block mapping',
    text: 'a: &a\n  l: *a\n  r: *a\n',
    asYaml: 'maxAliasCount',
    asJson: 'MalformedText',
  },
  {
    name: 'a text one byte past the size bound',
    text: 'a'.repeat(readLimits.maxTextBytes + 1),
    asYaml: 'maxTextBytes',
    asJson: 'maxTextBytes',
  },
];

function refusalOf(read: Read, text: string): string {
  const result = read(text);
  if (Either.isRight(result)) {
    return 'accepted';
  }
  return result.left._tag === 'ExceededReadLimit'
    ? result.left.limit
    : result.left._tag;
}

function failureOf(read: Read, text: string): ReadFailure | undefined {
  const result = read(text);
  return Either.isLeft(result) ? result.left : undefined;
}

describe('the read limits against the files the repository vendors', () => {
  it('stop no Threat Dragon file in the corpus, through either read', () => {
    const stopped = corpusTexts.flatMap((file) =>
      [readThreatDragon, readPanoptesYaml].flatMap((read) =>
        refusalOf(read, file.text).startsWith('max') ? [file.name] : [],
      ),
    );
    expect(stopped).toEqual([]);
  });

  it('stop none of the Panoptes YAML files this repository writes', () => {
    expect(
      nativeFixtures.map((file) => [
        file.name,
        refusalOf(readPanoptesYaml, file.text),
      ]),
    ).toEqual(nativeFixtures.map((file) => [file.name, 'accepted']));
  });

  it('keep the size bound ten times above the largest of them', () => {
    const largest = Math.max(...corpusTexts.map((file) => file.text.length));
    expect(readLimits.maxTextBytes).toBeGreaterThan(largest * 10);
  });

  it('are the numbers this release enforces', () => {
    expect(readLimits).toEqual({
      maxTextBytes: 4_194_304,
      maxNestingDepth: 64,
      maxAliasCount: 50,
      maxAliasExpansion: 100_000,
    });
  });
});

describe('an adversarial fixture', () => {
  it('stops the Panoptes YAML read at the bound it was built for', () => {
    expect(
      fixtures.map((entry) => [
        entry.name,
        refusalOf(readPanoptesYaml, entry.text),
      ]),
    ).toEqual(fixtures.map((entry) => [entry.name, entry.asYaml]));
  });

  it('stops the Threat Dragon read, at a bound where it is JSON at all', () => {
    expect(
      fixtures.map((entry) => [
        entry.name,
        refusalOf(readThreatDragon, entry.text),
      ]),
    ).toEqual(fixtures.map((entry) => [entry.name, entry.asJson]));
  });

  it('is read to a failure by both, and throws out of neither', () => {
    const refusals = fixtures.flatMap((entry) => [
      refusalOf(readPanoptesYaml, entry.text),
      refusalOf(readThreatDragon, entry.text),
    ]);
    expect(refusals).not.toContain('accepted');
  });
});

describe('the size bound', () => {
  it('names the size it measured, which for one byte past is that', () => {
    const text = 'a'.repeat(readLimits.maxTextBytes + 1);
    expect(failureOf(readThreatDragon, text)).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
      bound: readLimits.maxTextBytes,
      observed: readLimits.maxTextBytes + 1,
    });
  });

  it('counts the text in UTF-8 bytes rather than in code units', () => {
    const text = 'é'.repeat(readLimits.maxTextBytes);
    expect(failureOf(readThreatDragon, text)).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
      bound: readLimits.maxTextBytes,
      observed: readLimits.maxTextBytes * 2,
    });
  });

  it('reports the code units where those alone break it, unmeasured', () => {
    const text = 'é'.repeat(readLimits.maxTextBytes + 1);
    expect(failureOf(readThreatDragon, text)).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
      bound: readLimits.maxTextBytes,
      observed: readLimits.maxTextBytes + 1,
    });
  });

  it('admits a text of exactly the bound, to fail on its own merits', () => {
    expect(
      refusalOf(readThreatDragon, 'a'.repeat(readLimits.maxTextBytes)),
    ).toBe('MalformedText');
  });
});

describe('the nesting bound', () => {
  it('admits a value sitting exactly at it', () => {
    expect(
      refusalOf(readThreatDragon, nestedBy(readLimits.maxNestingDepth)),
    ).toBe('InvalidWireDocument');
  });

  it('refuses a value that branches back into itself, in work its width cannot grow', () => {
    const loop: Record<string, unknown> = {};
    loop['l'] = loop;
    loop['r'] = loop;
    expect(
      failureOf(
        (text) => parseWithinLimits(text, () => Either.right(loop)),
        '{}',
      ),
    ).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxNestingDepth',
      bound: readLimits.maxNestingDepth,
      observed: readLimits.maxNestingDepth + 1,
    });
  });

  it('measures a shared subtree from the deepest place it is reached', () => {
    const shallow = `${'['.repeat(40)}${']'.repeat(40)}`;
    const text = [
      `near: &shared ${shallow}`,
      'far:',
      ...Array.from({ length: 30 }, (_, step) => `${' '.repeat(step + 1)}in:`),
      `${' '.repeat(31)}- *shared`,
      '',
    ].join('\n');
    expect(refusalOf(readPanoptesYaml, text)).toBe('maxNestingDepth');
  });

  it('refuses a value one step past it, and says how far it got', () => {
    expect(
      failureOf(readThreatDragon, nestedBy(readLimits.maxNestingDepth + 1)),
    ).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxNestingDepth',
      bound: readLimits.maxNestingDepth,
      observed: readLimits.maxNestingDepth + 1,
    });
  });
});

describe('the alias bound', () => {
  it('counts an alias and the aliases its anchor expands to', () => {
    const document = parseDocument(vendored('alias-expansion.yaml'));
    expect(
      aliasCostIn(document, { expanded: 1_000, reached: 1_000 }).expanded,
    ).toBe(54);
  });

  it('stops that count where it holds, before an alias is resolved', () => {
    expect(
      failureOf(readPanoptesYaml, vendored('alias-expansion.yaml')),
    ).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxAliasCount',
      bound: readLimits.maxAliasCount,
      observed: readLimits.maxAliasCount + 1,
    });
  });

  it('refuses a cycle, which expands without end', () => {
    expect(failureOf(readPanoptesYaml, vendored('wide-cycle.yaml'))).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxAliasCount',
      bound: readLimits.maxAliasCount,
      observed: readLimits.maxAliasCount + 1,
    });
  });

  it('refuses anchors within anchors, which the parser charges per anchor', () => {
    expect(
      failureOf(readPanoptesYaml, vendored('nested-anchors.yaml')),
    ).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxAliasCount',
      bound: readLimits.maxAliasCount,
      observed: readLimits.maxAliasCount + 1,
    });
  });

  it('is this package measuring, where the parser is now handed nothing', () => {
    const text = vendored('alias-expansion.yaml');
    expect(refusalOf(readPanoptesYaml, text)).toBe('maxAliasCount');
    expect(() => {
      parse(text);
    }).not.toThrow();
  });
});

describe('the alias expansion bound', () => {
  it('counts what the aliases reach, and stops counting where it holds', () => {
    expect(failureOf(readPanoptesYaml, vendored('shared-anchor.yaml'))).toEqual(
      {
        _tag: 'ExceededReadLimit',
        limit: 'maxAliasExpansion',
        bound: readLimits.maxAliasExpansion,
        observed: readLimits.maxAliasExpansion + 1,
      },
    );
  });

  it('is what an alias reaches rather than how many aliases there are', () => {
    expect(refusalOf(readPanoptesYaml, sharedFromDepths(1, 40))).toBe(
      'InvalidWireDocument',
    );
  });

  it('counts a mapping anchor by its keys and its values alike', () => {
    const document = parseDocument(
      'shared: &shared { a: 1, b: 2 }\nuse: [*shared, *shared]\n',
    );
    expect(
      aliasCostIn(document, { expanded: 1_000, reached: 1_000 }).reached,
    ).toBe(10);
  });

  it('leaves an alias with no anchor to the parser', () => {
    expect(refusalOf(readPanoptesYaml, 'a: *missing\n')).toBe('MalformedText');
  });
});

describe('a generated fixture', () => {
  it('is the bytes its generator writes, so the file cannot drift', () => {
    expect([sharedFromDepths(3_000, 40), nestedAnchors(25)]).toEqual([
      vendored('shared-anchor.yaml'),
      vendored('nested-anchors.yaml'),
    ]);
  });
});
