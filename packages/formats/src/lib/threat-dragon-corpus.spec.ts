import { Either } from 'effect';
import { readThreatDragon } from './threat-dragon-read.js';
import { corpusTexts } from './threat-dragon.fixtures.js';

const readings = corpusTexts.map((file) => ({
  name: file.name,
  result: readThreatDragon(file.text),
}));

const refused = readings.filter((reading) => Either.isLeft(reading.result));

const undeclared = readings.flatMap((reading) =>
  Either.isRight(reading.result)
    ? reading.result.right.divergences
        .filter((divergence) => divergence.reason === 'undeclared')
        .map((divergence) => `${reading.name}: ${divergence.detail}`)
    : [],
);

describe('every Threat Dragon file the repository vendors', () => {
  it('is the corpus the codec claims to read', () => {
    expect(corpusTexts).toHaveLength(13);
  });

  it('reads, so the codec refuses none of the format its author ships', () => {
    expect(refused.map((reading) => reading.name)).toEqual([]);
  });

  it('holds no key the wire schema fails to declare', () => {
    expect(undeclared).toEqual([]);
  });
});
