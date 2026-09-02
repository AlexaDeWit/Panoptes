import { Ajv } from 'ajv';
import { Either } from 'effect';
import { allThreats } from './threat-dragon-document.js';
import { readThreatDragon } from './threat-dragon-read.js';
import type { ThreatDragonDocument } from './threat-dragon-wire.js';
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

/**
 * Every file of the corpus read, written straight back onto the document it
 * was read from, and read once more. The raw parsed text is kept beside the
 * raw parsed output, so the comparison below runs on what each file says
 * rather than on what the wire schema kept of it.
 */
const roundTrips = corpusTexts.map((file) => {
  const read = Either.getOrThrowWith(
    readThreatDragon(file.text),
    () => new Error(`The corpus file ${file.name} no longer reads.`),
  );
  const written = writeThreatDragon(read.model, read.source);
  return {
    name: file.name,
    source: read.source,
    model: read.model,
    written,
    before: JSON.parse(file.text) as unknown,
    after: JSON.parse(written.output) as unknown,
    reread: readThreatDragon(written.output),
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

/** Every path a scalar the input carried is missing from or differs at. */
const moved = (before: unknown, after: unknown): ReadonlySet<string> => {
  const written = scalarsOf(after, '', new Map());
  return new Set(
    [...scalarsOf(before, '', new Map())]
      .filter(([path, value]) => written.get(path) !== value)
      .map(([path]) => path),
  );
};

/**
 * The paths a write of an unedited model may move, read off the source
 * document rather than off the writer: the release stamp wherever the file
 * carries another one, and the threat high-water mark where the file left a
 * threat unnumbered, since writing that number down is what raises the mark.
 */
const stamps = (source: ThreatDragonDocument): ReadonlySet<string> =>
  new Set([
    ...(source.version === writtenVersion ? [] : ['version']),
    ...source.detail.diagrams.flatMap((diagram, index) =>
      diagram.version === undefined || diagram.version === writtenVersion
        ? []
        : [`detail.diagrams.${index}.version`],
    ),
    ...(allThreats(source).some((threat) => threat.number === undefined)
      ? ['detail.threatTop']
      : []),
  ]);

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
    ({ source, before, after }) => {
      expect(moved(before, after)).toEqual(stamps(source));
    },
  );

  it.each(roundTrips)(
    'reports every scalar it moved in $name, and nothing besides',
    ({ source, written }) => {
      expect(
        written.divergences.map((divergence) => divergence.reason),
      ).toEqual([...stamps(source)].map(() => 'overridden'));
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
  });

  it('reports no divergence at all', () => {
    expect(ecluse.written.divergences).toEqual([]);
  });
});
