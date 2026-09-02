import { Either } from 'effect';
import { renderDivergences } from './divergence.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { planThreats } from './threat-dragon-threats.js';
import type { ThreatDragonDocument } from './threat-dragon-wire.js';
import {
  complementFixture,
  ecluseText,
  parsedFixture,
  richerThanFormatFixture,
  type ModelInput,
} from './threat-dragon.fixtures.js';

const readOrThrow = (text: string) =>
  Either.getOrThrowWith(
    readThreatDragon(text),
    (failure) => new Error(`The codec refused a text: ${failure._tag}`),
  );

const ecluse = readOrThrow(ecluseText);

const richer = parsedFixture(richerThanFormatFixture);

const model = (
  threats: ModelInput['threats'],
  lastIssuedThreatNumber: number,
) =>
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
    threats,
    lastIssuedThreatNumber,
    mitigations: [],
    assumptions: [],
  });

const threat = (number: number): ModelInput['threats'][number] => ({
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

/** A document holding a numbered threat and declaring no mark of its own. */
const undeclaredDocument: ThreatDragonDocument = {
  version: '2.6.2',
  summary: { title: '' },
  detail: {
    diagrams: [
      {
        id: 0,
        title: '',
        diagramType: 'STRIDE',
        cells: [
          {
            id: 'cell-1',
            shape: 'process',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
            data: {
              type: 'tm.Process',
              threats: [
                {
                  id: 'threat-4',
                  number: 4,
                  title: '',
                  modelType: 'STRIDE',
                  type: 'Tampering',
                  status: 'Open',
                  severity: 'Low',
                  description: '',
                  mitigation: '',
                },
              ],
            },
          },
        ],
      },
    ],
  },
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
    expect(planThreats(ecluse.model, ecluse.source).threatTop.value).toBe(28);
    expect(ecluse.model.lastIssuedThreatNumber).toBe(102);
  });

  it('covers a number this write puts in a file that lacked it', () => {
    const written = model([threat(3)], 3);
    expect(planThreats(written, emptyDocument).threatTop).toEqual({
      value: 3,
      cause: 'issued',
    });
  });

  it('covers what a file declaring no mark of its own already holds', () => {
    const written = model([threat(4)], 4);
    expect(undeclaredDocument.detail.threatTop).toBeUndefined();
    expect(planThreats(written, undeclaredDocument).threatTop).toEqual({
      value: 4,
      cause: 'issued',
    });
  });

  it('rises to the model mark where the numbers in the file cannot reach it', () => {
    const written = model([threat(3)], 40);
    expect(planThreats(written, undefined).threatTop).toEqual({
      value: 40,
      cause: 'unreachable',
    });
  });

  it('never falls below what the file declared', () => {
    const written = model([], 0);
    expect(
      planThreats(written, {
        ...emptyDocument,
        detail: { ...emptyDocument.detail, threatTop: 60 },
      }).threatTop.value,
    ).toBe(60);
  });
});

describe('a threat the source document already nests under two cells', () => {
  it('is not the record this write split, so nothing is reported', () => {
    const read = readOrThrow(JSON.stringify(complementFixture));
    const plan = planThreats(read.model, read.source);
    expect(read.model.threats[0]?.elements.map((id) => String(id))).toEqual([
      'actor-1',
      'store-1',
    ]);
    expect(plan.divergences).toEqual([]);
  });

  it('is reported where this write is the one dividing it', () => {
    const read = readOrThrow(JSON.stringify(complementFixture));
    expect(
      renderDivergences(planThreats(read.model, undefined).divergences),
    ).toBe(
      'threat "threat-linkability": the one record, written once under each of the 2 elements it names (split by the format)',
    );
  });
});
