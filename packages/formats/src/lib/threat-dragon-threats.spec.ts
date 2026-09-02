import { Either } from 'effect';
import { renderDivergences } from './divergence.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { planThreats } from './threat-dragon-threats.js';
import type { ThreatDragonDocument } from './threat-dragon-wire.js';
import {
  ecluseText,
  parsedFixture,
  richerThanFormatFixture,
} from './threat-dragon.fixtures.js';

const readOrThrow = (text: string) =>
  Either.getOrThrowWith(
    readThreatDragon(text),
    (failure) => new Error(`The codec refused a text: ${failure._tag}`),
  );

const ecluse = readOrThrow(ecluseText);

const richer = parsedFixture(richerThanFormatFixture);

const model = (part: Readonly<Record<string, unknown>>) =>
  parsedFixture({
    metadata: { title: '', owner: '', description: '', contributors: [] },
    diagrams: [
      {
        id: '0',
        title: '',
        elements: [
          {
            kind: 'process',
            id: 'cell-1',
            name: '',
            description: '',
            outOfScope: false,
            reasonOutOfScope: '',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
          },
        ],
      },
    ],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
    ...part,
  });

const threat = (number: number) => ({
  id: `threat-${number}`,
  number,
  title: '',
  category: { methodology: 'STRIDE', category: 'tampering' },
  severity: 'low',
  status: 'open',
  description: '',
  mitigation: '',
  elements: ['cell-1'],
});

const emptyDocument: ThreatDragonDocument = {
  version: '2.6.2',
  summary: { title: '' },
  detail: { diagrams: [] },
};

describe('placing the threats of a model under the cells that host them', () => {
  it('nests each under the cell it names, in the order the file had them', () => {
    const plan = planThreats(ecluse.model, ecluse.source);
    expect(
      [...plan.byCell].map(([id, threats]) => [id, threats.length]),
    ).toHaveLength(13);
    expect(plan.divergences).toEqual([]);
  });

  it('names what the format nests a threat under nowhere', () => {
    expect(
      renderDivergences(planThreats(richer, undefined).divergences).split('\n'),
    ).toEqual([
      'threat "threat-split": the one record, written once under each of the 2 elements it names (split by the format)',
      'threat "threat-privacy": the PLOT4ai category "cybersecurity", which Threat Dragon\'s own labels do not name (reduced to fit the format)',
      'threat "threat-zone": the attachment to the trust-boundary "element-zone", which the format nests a threat under an actor, a process, a store, or a flow alone (no place in the format)',
      'threat "threat-zone": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
      'threat "threat-unattached": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
    ]);
  });

  it('writes a split threat under every cell it names', () => {
    const plan = planThreats(richer, undefined);
    expect(
      [...plan.byCell].map(([id, threats]) => [
        id,
        threats.map((held) => held.id),
      ]),
    ).toEqual([
      ['element-ledger', ['threat-split']],
      ['element-vault', ['threat-split']],
      ['element-clerk', ['threat-privacy']],
    ]);
  });
});

describe('the high-water mark a plan writes', () => {
  it('repeats what the file declared where every number is already in it', () => {
    expect(planThreats(ecluse.model, ecluse.source).threatTop).toBe(28);
    expect(ecluse.model.lastIssuedThreatNumber).toBe(102);
  });

  it('covers a number this write puts in a file that lacked it', () => {
    const written = model({
      threats: [threat(3)],
      lastIssuedThreatNumber: 3,
    });
    expect(planThreats(written, emptyDocument).threatTop).toBe(3);
  });

  it('rises to the model mark where the numbers in the file cannot reach it', () => {
    const written = model({
      threats: [threat(3)],
      lastIssuedThreatNumber: 40,
    });
    expect(planThreats(written, undefined).threatTop).toBe(40);
  });

  it('never falls below what the file declared', () => {
    const written = model({ threats: [], lastIssuedThreatNumber: 0 });
    expect(
      planThreats(written, {
        ...emptyDocument,
        detail: { ...emptyDocument.detail, threatTop: 60 },
      }).threatTop,
    ).toBe(60);
  });
});
