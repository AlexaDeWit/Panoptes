import {
  addElement,
  addDiagram,
  parseModel,
  removeElement,
  selectionFragment,
  remapFragment,
  insertFragment,
  moveElement,
  renameElement,
  resizeElement,
  setFlowDirection,
  setFlowWaypoints,
  reconnectFlow,
  type Model,
} from '@saerskriven/model';
import {
  diagramId,
  elementId,
  parsedFixture,
  validModelFixture,
  securityModelFixture,
  securityPropertyFixtures as properties,
} from '@saerskriven/model/fixtures';
import { threatDragonWireSchema } from '@saerskriven/wire-threat-dragon';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import {
  writeSaerskrivenYaml,
  writeSaerskrivenYamlDocument,
} from './saerskriven-yaml-write.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { writeThreatDragon } from './threat-dragon-write.js';
import { allCells, threatsOf } from './threat-dragon-document.js';
import { isRecord } from './records.js';
import { readFailureIssues } from './codec.js';

const secured = parsedFixture(securityModelFixture);

function nativeCycle(model: Model): Model {
  const written = writeSaerskrivenYaml(model);
  expect(written.divergences).toEqual([]);
  const read = Either.getOrThrow(readSaerskrivenYaml(written.output));
  expect(read.divergences).toEqual([]);
  return read.model;
}

const factKeys = [
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
];

function facts(record: unknown) {
  return isRecord(record)
    ? Object.fromEntries(
        factKeys
          .filter((key) => Object.hasOwn(record, key))
          .map((key) => [key, record[key]]),
      )
    : {};
}

function elementFacts(model: Model) {
  return model.diagrams.flatMap((diagram) =>
    diagram.elements.map((element) => ({ id: element.id, ...facts(element) })),
  );
}

describe('optional security facts in native v1', () => {
  it('retains explicit facts on every supported kind, including false, empty text and empty lists', () => {
    const cycle = nativeCycle(secured);
    expect(cycle).toStrictEqual(secured);
    expect(cycle.diagrams[0].elements.map(facts)).toEqual(properties);
    expect(writeSaerskrivenYamlDocument(cycle).formatVersion).toBe(1);
  });

  it('reads legacy fields as absent and does not turn them into explicit negatives', () => {
    const legacy = parsedFixture(validModelFixture);
    const cycle = nativeCycle(legacy);
    expect(cycle).toStrictEqual(legacy);
    expect(cycle.diagrams[0].elements.map(facts)).toEqual(
      properties.map(() => ({})),
    );
  });

  it('preserves an explicitly empty flow protocol and boundary list', () => {
    const input = structuredClone(secured);
    const flow = input.diagrams[0].elements.find(
      (element) => element.kind === 'flow',
    );
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    flow.protocol = '';
    flow.trustBoundaryIds = [];
    expect(nativeCycle(input)).toStrictEqual(input);
  });

  it('keeps security facts during unrelated geometry, name and flow edits', () => {
    let edited = Either.getOrThrow(
      renameElement(secured, elementId('element-api'), 'Renamed'),
    );
    edited = Either.getOrThrow(
      moveElement(edited, elementId('element-perimeter'), { x: 1000, y: 1000 }),
    );
    edited = Either.getOrThrow(
      resizeElement(edited, elementId('element-db'), {
        width: 200,
        height: 90,
      }),
    );
    edited = Either.getOrThrow(
      setFlowDirection(edited, elementId('element-order-flow'), true),
    );
    edited = Either.getOrThrow(
      setFlowWaypoints(edited, elementId('element-order-flow'), []),
    );
    edited = Either.getOrThrow(
      reconnectFlow(
        edited,
        elementId('element-order-flow'),
        'target',
        elementId('element-api'),
      ),
    );
    expect(elementFacts(nativeCycle(edited))).toStrictEqual(
      elementFacts(secured),
    );
  });
});

describe('security facts across Threat Dragon and native YAML', () => {
  it('writes every fact without the original JSON and reads it through native YAML', () => {
    const written = writeThreatDragon(secured);
    const read = Either.getOrThrow(readThreatDragon(written.output));
    expect(elementFacts(nativeCycle(read.model))).toStrictEqual(
      elementFacts(secured),
    );
    const reverse = Either.getOrThrow(
      readThreatDragon(writeThreatDragon(nativeCycle(secured)).output),
    );
    expect(elementFacts(reverse.model)).toStrictEqual(elementFacts(secured));
  });

  it('keeps source styling while writing explicit changes and removals to mapped facts', () => {
    const read = Either.getOrThrow(
      readThreatDragon(writeThreatDragon(secured).output),
    );
    const source = structuredClone(read.source);
    const actor = allCells(source).find((cell) => cell.shape === 'actor');
    expect(actor).toBeDefined();
    if (actor === undefined) return;
    actor.zIndex = 321;
    const edited = structuredClone(read.model);
    const node = edited.diagrams[0].elements.find(
      (element) => element.kind === 'actor',
    );
    expect(node).toBeDefined();
    if (node === undefined) return;
    node.providesAuthentication = true;
    const changed = Either.getOrThrow(
      readThreatDragon(writeThreatDragon(edited, source).output),
    );
    expect(elementFacts(changed.model)[0]).toEqual({
      id: node.id,
      providesAuthentication: true,
    });
    expect(allCells(changed.source)[0].zIndex).toBe(321);
    delete node.providesAuthentication;
    const removed = Either.getOrThrow(
      readThreatDragon(writeThreatDragon(edited, source).output),
    );
    expect(facts(allCells(removed.source)[0].data)).toEqual({});
    expect(facts(removed.model.diagrams[0].elements[0])).toEqual({});
  });

  it('refuses unrepresentable security text with a model path instead of reporting a lossless read', () => {
    const source = threatDragonWireSchema.parse(
      JSON.parse(writeThreatDragon(secured).output),
    );
    const flow = allCells(source).find((cell) => cell.shape === 'flow');
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    flow.data.protocol = '\u202EHTTPS';
    const read = readThreatDragon(JSON.stringify(source));
    expect(Either.isLeft(read)).toBe(true);
    expect(
      readFailureIssues(Either.getOrThrow(Either.flip(read))),
    ).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 3, 'protocol'],
      }),
    );
  });
});

describe('the current Écluse migration', () => {
  it('preserves source facts, declared relationships, threat links, numbers and issuance bookkeeping', () => {
    const text = readFileSync(
      join(import.meta.dirname, '../../../../test-data/ecluse-security.json'),
      'utf8',
    );
    const before = Either.getOrThrow(readThreatDragon(text));
    expect(before.divergences).toEqual([]);
    const expected = allCells(before.source).map((cell) => ({
      id: cell.id,
      ...facts(cell.data),
    }));
    expect(elementFacts(before.model)).toStrictEqual(expected);
    const after = nativeCycle(before.model);
    expect(elementFacts(after)).toStrictEqual(expected);
    const sourceAttachments = allCells(before.source).flatMap((cell) =>
      threatsOf(cell).map((threat) =>
        JSON.stringify([threat.id, threat.number, cell.id]),
      ),
    );
    const restoredAttachments = after.threats.flatMap((threat) =>
      threat.elements.map((id) =>
        JSON.stringify([threat.id, threat.number, id]),
      ),
    );
    expect(new Set(restoredAttachments)).toEqual(new Set(sourceAttachments));
    expect(after.lastIssuedThreatNumber).toBe(
      Math.max(
        before.source.detail.threatTop ?? 0,
        ...allCells(before.source).flatMap((cell) =>
          threatsOf(cell).map((threat) => threat.number ?? 0),
        ),
      ),
    );
    expect(new Map(after.threats.map((threat) => [threat.id, threat]))).toEqual(
      new Map(before.model.threats.map((threat) => [threat.id, threat])),
    );
    expect(after.lastIssuedThreatNumber).toBe(
      before.model.lastIssuedThreatNumber,
    );
    const written = writeThreatDragon(after);
    const restored = Either.getOrThrow(readThreatDragon(written.output));
    expect(restored.divergences).toEqual([]);
    expect(elementFacts(restored.model)).toStrictEqual(expected);
    expect(
      new Map(restored.model.threats.map((threat) => [threat.id, threat])),
    ).toEqual(new Map(after.threats.map((threat) => [threat.id, threat])));
    expect(restored.model.lastIssuedThreatNumber).toBe(
      after.lastIssuedThreatNumber,
    );
    expect(restored.source.detail.threatTop).toBe(after.lastIssuedThreatNumber);
    expect(writeThreatDragon(before.model, before.source).divergences).toEqual(
      [],
    );
  });
});

describe('declared relationship validation and edits', () => {
  it('refuses invalid Threat Dragon relationship assertions without changing the source', () => {
    const original = writeThreatDragon(secured).output;
    const source = threatDragonWireSchema.parse(JSON.parse(original));
    const flow = allCells(source).find((cell) => cell.shape === 'flow');
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    flow.data.trustBoundaryIds = ['missing-boundary'];
    const supplied = JSON.stringify(source);
    const result = readThreatDragon(supplied);
    expect(
      readFailureIssues(Either.getOrThrow(Either.flip(result))),
    ).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 3, 'trustBoundaryIds', 0],
      }),
    );
    expect(JSON.stringify(source)).toBe(supplied);
  });

  it.each([
    ['trustBoundaryIds', 'element-db'],
    ['trustBoundaryIds', 'missing-boundary'],
    ['crossingFlows', 'element-api'],
    ['containedElements', 'element-perimeter'],
  ])('refuses invalid %s targets with a field path', (field, reference) => {
    const source = writeSaerskrivenYamlDocument(secured);
    const index = field === 'trustBoundaryIds' ? 3 : 4;
    Object.assign(source.diagrams[0].elements[index], { [field]: [reference] });
    const result = readSaerskrivenYaml(JSON.stringify(source));
    expect(Either.isLeft(result)).toBe(true);
    expect(
      readFailureIssues(Either.getOrThrow(Either.flip(result))),
    ).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', index, field, 0],
      }),
    );
  });

  it('refuses cross-diagram references and checks new elements and diagrams', () => {
    const boundary = secured.diagrams[0].elements[4];
    const outside = parsedFixture({
      ...secured,
      threats: [],
      mitigations: [],
      assumptions: [],
      diagrams: [
        {
          ...secured.diagrams[0],
          elements: secured.diagrams[0].elements.slice(0, 3),
        },
        { id: 'other', title: 'Other', elements: [] },
      ],
    });
    expect(
      Either.isLeft(addElement(outside, diagramId('other'), boundary)),
    ).toBe(true);
    expect(
      Either.isLeft(
        addDiagram(outside, {
          id: diagramId('new'),
          title: 'New',
          elements: [boundary],
        }),
      ),
    ).toBe(true);
    const invalid = {
      ...outside,
      diagrams: [
        ...outside.diagrams,
        { id: 'third', title: 'Third', elements: [boundary] },
      ],
    };
    expect(Either.isLeft(parseModel(invalid))).toBe(true);
  });

  it('keeps ordered repeated assertions without inventing reciprocal lists', () => {
    const draft = structuredClone(secured);
    const boundary = draft.diagrams[0].elements.find(
      (element) => element.kind === 'trust-boundary',
    );
    expect(boundary).toBeDefined();
    if (boundary === undefined) return;
    boundary.crossingFlows = [
      elementId('element-order-flow'),
      elementId('element-order-flow'),
    ];
    const flow = draft.diagrams[0].elements.find(
      (element) => element.kind === 'flow',
    );
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    delete flow.trustBoundaryIds;
    expect(nativeCycle(draft)).toStrictEqual(draft);
  });

  it('removes only references to the explicitly deleted element, keeping absence distinct from empty', () => {
    const withoutStore = Either.getOrThrow(
      removeElement(secured, elementId('element-db')),
    );
    expect(
      withoutStore.diagrams[0].elements.find(
        (element) => element.id === 'element-perimeter',
      ),
    ).toMatchObject({
      containedElements: ['element-api'],
      crossingFlows: ['element-order-flow'],
    });
    const withoutFlow = Either.getOrThrow(
      removeElement(withoutStore, elementId('element-order-flow')),
    );
    expect(
      withoutFlow.diagrams[0].elements.find(
        (element) => element.id === 'element-perimeter',
      ),
    ).toMatchObject({ containedElements: ['element-api'], crossingFlows: [] });
    const withoutBoundary = Either.getOrThrow(
      removeElement(secured, elementId('element-perimeter')),
    );
    expect(
      withoutBoundary.diagrams[0].elements.find(
        (element) => element.kind === 'flow',
      ),
    ).toMatchObject({ trustBoundaryIds: [] });
    expect(Either.isRight(parseModel(withoutBoundary))).toBe(true);
    const legacy = parsedFixture(validModelFixture);
    const removed = Either.getOrThrow(
      removeElement(legacy, elementId('element-perimeter')),
    );
    expect(removed.diagrams[0].elements.map(facts)).toEqual(
      removed.diagrams[0].elements.map(() => ({})),
    );
    expect(secured.diagrams[0].elements[4]).toMatchObject(properties[4]);
  });

  it('restricts copied lists to selected targets and remaps every retained relationship', () => {
    const partial = Either.getOrThrow(
      selectionFragment(secured, diagramId('diagram-main'), [
        elementId('element-perimeter'),
        elementId('element-api'),
      ]),
    );
    expect(
      partial.diagrams[0].elements.find(
        (element) => element.kind === 'trust-boundary',
      ),
    ).toMatchObject({ containedElements: ['element-api'], crossingFlows: [] });
    const full = Either.getOrThrow(
      selectionFragment(
        secured,
        diagramId('diagram-main'),
        secured.diagrams[0].elements.map((element) => element.id),
      ),
    );
    const remapped = Either.getOrThrow(
      remapFragment(full, 'copy', { x: 20, y: 30 }),
    );
    expect(remapped.diagrams[0].elements[3]).toMatchObject({
      trustBoundaryIds: ['copy:element-perimeter'],
    });
    expect(remapped.diagrams[0].elements[4]).toMatchObject({
      containedElements: ['copy:element-api', 'copy:element-db'],
      crossingFlows: ['copy:element-order-flow'],
    });
    const inserted = Either.getOrThrow(
      insertFragment(secured, diagramId('diagram-main'), remapped),
    );
    expect(Either.isRight(parseModel(inserted))).toBe(true);
    expect(elementFacts(inserted).slice(0, 6)).toEqual(elementFacts(secured));
  });
});
