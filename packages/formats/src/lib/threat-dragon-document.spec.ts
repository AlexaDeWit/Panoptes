import type { ThreatDragonDocument } from '@panoptes/wire-threat-dragon';
import { Either } from 'effect';
import {
  allCells,
  allThreats,
  cellsOf,
  hostsThreats,
  indexById,
  isAnchored,
  threatsOf,
} from './threat-dragon-document.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { complementFixture, ecluseText } from './threat-dragon.fixtures.js';

const documentOf = (text: string): ThreatDragonDocument =>
  Either.getOrThrowWith(
    readThreatDragon(text),
    (failure) => new Error(`The codec refused a text: ${failure._tag}`),
  ).source;

const ecluse = documentOf(ecluseText);

const complement = documentOf(JSON.stringify(complementFixture));

describe('walking a Threat Dragon document', () => {
  it('reaches every threat the diagrams nest under their cells', () => {
    expect(allCells(ecluse)).toHaveLength(38);
    expect(allThreats(ecluse)).toHaveLength(29);
  });

  it('reads a diagram that draws nothing as drawing nothing', () => {
    expect(cellsOf(complement.detail.diagrams[1])).toEqual([]);
  });

  it('nests threats under the four shapes a threat attaches to', () => {
    expect(
      allCells(complement)
        .filter(hostsThreats)
        .map((cell) => cell.shape),
    ).toEqual(['actor', 'store', 'flow']);
    expect(
      allCells(complement)
        .filter((cell) => !hostsThreats(cell))
        .flatMap(threatsOf),
    ).toEqual([]);
  });

  it('keeps the first of a repeated id, as one nested under two cells', () => {
    expect([...indexById(allThreats(complement)).keys()]).toEqual([
      'threat-linkability',
      'threat-ethics',
    ]);
  });

  it('tells an endpoint on a cell from one on empty canvas', () => {
    expect(isAnchored({ cell: 'actor-1' })).toBe(true);
    expect(isAnchored({ x: 0, y: 0 })).toBe(false);
  });
});
