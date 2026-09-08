import { Either } from 'effect';
import { diagramId, elementId, parsedFixture } from '../fixtures.js';
import { validModelFixture } from './fixtures.js';
import {
  insertFragment,
  remapFragment,
  selectionFragment,
} from './fragment.js';
import { parseModel } from './parse.js';

const model = parsedFixture(validModelFixture);
const diagram = diagramId('diagram-main');

it('copies related records once, excludes external links, and does not change the source', () => {
  const before = structuredClone(model);
  const fragment = Either.getOrThrow(
    selectionFragment(model, diagram, [elementId('element-api')]),
  );
  expect(fragment.diagrams[0].elements.map((element) => element.id)).toEqual([
    'element-api',
  ]);
  expect(fragment.threats.length).toBeGreaterThan(0);
  expect(fragment.threats[0].elements).toEqual(['element-api']);
  expect(fragment.mitigations.length).toBeGreaterThan(0);
  expect(fragment.assumptions.length).toBeGreaterThan(0);
  expect(Either.isRight(parseModel(fragment))).toBe(true);
  expect(model).toEqual(before);
});

it('includes the endpoint of a selected flow and keeps its free endpoint', () => {
  const flow = model.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  expect(flow?.kind).toBe('flow');
  if (flow?.kind !== 'flow') {
    return;
  }
  const fragment = Either.getOrThrow(
    selectionFragment(model, diagram, [flow.id]),
  );
  expect(fragment.diagrams[0].elements).toContainEqual(flow);
  expect(fragment.diagrams[0].elements.map((element) => element.id)).toEqual(
    expect.arrayContaining(['element-order-flow', 'element-customer']),
  );
  expect(Either.isRight(parseModel(fragment))).toBe(true);
});

it('remaps references and geometry, issues new numbers, and rejects an ID collision atomically', () => {
  const fragment = Either.getOrThrow(
    selectionFragment(
      model,
      diagram,
      model.diagrams[0].elements.map((element) => element.id),
    ),
  );
  const fresh = Either.getOrThrow(
    remapFragment(fragment, 'fresh', { x: 20, y: 30 }),
  );
  const inserted = Either.getOrThrow(insertFragment(model, diagram, fresh));
  expect(
    inserted.threats.slice(model.threats.length).map((threat) => threat.number),
  ).toEqual(
    fragment.threats.map(
      (_, index) => model.lastIssuedThreatNumber + index + 1,
    ),
  );
  expect(
    inserted.diagrams[0].elements
      .slice(model.diagrams[0].elements.length)
      .every((element) => element.id.startsWith('fresh:')),
  ).toBe(true);
  expect(Either.isRight(parseModel(inserted))).toBe(true);
  expect(Either.isLeft(insertFragment(inserted, diagram, fresh))).toBe(true);
  expect(fresh.diagrams[0].elements[0]).toMatchObject({
    position: { x: 60, y: 150 },
  });
});
