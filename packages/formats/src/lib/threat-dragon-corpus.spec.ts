import { diagramIdSchema } from '@panoptes/model';
import type { ThreatDragonDocument } from '@panoptes/wire-threat-dragon';
import { Ajv } from 'ajv';
import { Either } from 'effect';
import type { Divergence } from './divergence.js';
import { allThreats } from './threat-dragon-document.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { writeThreatDragon } from './threat-dragon-write.js';
import {
  corpusTexts,
  threatDragonJsonSchema,
} from './threat-dragon.fixtures.js';

const writtenVersion = '2.6.2';

const validate = new Ajv({ allowUnionTypes: true }).compile(
  threatDragonJsonSchema,
);

const readings = corpusTexts.map((file) => ({
  name: file.name,
  result: readThreatDragon(file.text),
}));

const refused = readings.filter((reading) => Either.isLeft(reading.result));

const diverged = readings.flatMap((reading) =>
  Either.isRight(reading.result)
    ? reading.result.right.divergences.map(
        (divergence) =>
          `${reading.name}: ${divergence.detail} (${divergence.reason})`,
      )
    : [],
);

const roundTrips = corpusTexts.map((file) => {
  const read = Either.getOrThrowWith(
    readThreatDragon(file.text),
    () => new Error(`The corpus file ${file.name} no longer reads.`),
  );
  const written = writeThreatDragon(read.model, read.source);
  const reread = readThreatDragon(written.output);
  return {
    name: file.name,
    source: read.source,
    model: read.model,
    written,
    before: JSON.parse(file.text) as unknown,
    after: JSON.parse(written.output) as unknown,
    document: Either.getOrThrowWith(
      reread,
      () => new Error(`The write of ${file.name} no longer reads back.`),
    ).source,
    reread,
  };
});

const scalarsOf = (
  value: unknown,
  path: string,
  into: Map<string, unknown>,
): ReadonlyMap<string, unknown> => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scalarsOf(entry, `${path}.${index}`, into));
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, held] of Object.entries(value)) {
      scalarsOf(held, path === '' ? key : `${path}.${key}`, into);
    }
  } else {
    into.set(path, value);
  }
  return into;
};

const moved = (before: unknown, after: unknown): ReadonlySet<string> => {
  const written = scalarsOf(after, '', new Map());
  return new Set(
    [...scalarsOf(before, '', new Map())]
      .filter(([path, value]) => written.get(path) !== value)
      .map(([path]) => path),
  );
};

const released = (
  from: string,
  subject: Divergence['subject'],
): Divergence => ({
  subject,
  detail: `the release "${from}" the source was written by, for the ${writtenVersion} this codec writes`,
  reason: 'overridden',
});

const stamps = (
  source: ThreatDragonDocument,
  after: ThreatDragonDocument,
): readonly { path: string; divergence: Divergence }[] => [
  ...(source.version === writtenVersion
    ? []
    : [
        {
          path: 'version',
          divergence: released(source.version, { kind: 'model' }),
        },
      ]),
  ...(allThreats(source).some((threat) => threat.number === undefined)
    ? [
        {
          path: 'detail.threatTop',
          divergence: {
            subject: { kind: 'model' as const },
            detail: `the threat high-water mark ${source.detail.threatTop}, raised to ${after.detail.threatTop} to cover a number this write issued`,
            reason: 'overridden' as const,
          },
        },
      ]
    : []),
  ...source.detail.diagrams.flatMap((diagram, index) =>
    diagram.version === undefined || diagram.version === writtenVersion
      ? []
      : [
          {
            path: `detail.diagrams.${index}.version`,
            divergence: released(diagram.version, {
              kind: 'diagram' as const,
              id: diagramIdSchema.parse(String(diagram.id)),
            }),
          },
        ],
  ),
];

const stampedPaths = (
  source: ThreatDragonDocument,
  after: ThreatDragonDocument,
): ReadonlySet<string> =>
  new Set(stamps(source, after).map((held) => held.path));

describe('every Threat Dragon file the repository vendors', () => {
  it('is the corpus the codec claims to read', () => {
    expect(corpusTexts).toHaveLength(13);
  });

  it('reads, so the codec refuses none of the format its author ships', () => {
    expect(refused.map((reading) => reading.name)).toEqual([]);
  });

  it('reads whole: no key undeclared, no value held less exactly', () => {
    expect(diverged).toEqual([]);
  });
});

describe('writing every vendored file back onto its own document', () => {
  it.each(roundTrips)(
    'moves no scalar of $name but the stamp this codec writes',
    ({ source, document, before, after }) => {
      expect(moved(before, after)).toEqual(stampedPaths(source, document));
    },
  );

  it.each(roundTrips)(
    'names every scalar it moved in $name, and claims nothing besides',
    ({ source, document, written }) => {
      expect(written.divergences).toEqual(
        stamps(source, document).map((held) => held.divergence),
      );
    },
  );

  it.each(roundTrips)(
    'reads $name back as the model it was written from',
    ({ model, reread }) => {
      expect(Either.isRight(reread) && reread.right.model).toEqual(model);
    },
  );

  it.each(roundTrips)(
    'leaves $name a file Threat Dragon still validates as its own',
    ({ after }) => {
      expect({ valid: validate(after), errors: validate.errors }).toEqual({
        valid: true,
        errors: null,
      });
    },
  );
});

describe('the Écluse model, the one file this codec preserves whole', () => {
  const ecluse = roundTrips[0];

  it('is the file the rest of the corpus is measured beside', () => {
    expect(ecluse.name).toBe('ecluse.json');
  });

  it('comes back with every scalar it went in with, and no stamp moved', () => {
    expect(moved(ecluse.before, ecluse.after)).toEqual(new Set());
    expect(stamps(ecluse.source, ecluse.document)).toEqual([]);
  });

  it('reports no divergence at all', () => {
    expect(ecluse.written.divergences).toEqual([]);
  });
});
