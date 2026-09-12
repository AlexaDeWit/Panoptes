import { Either } from 'effect';
import { validModelFixture } from './fixtures.js';
import { parseModel, type Model } from './parse.js';
import { diagramsNamed } from './references.js';

const model: Model = Either.getOrThrowWith(
  parseModel({
    ...validModelFixture,
    diagrams: [
      ...validModelFixture.diagrams,
      { id: 'diagram-second', title: 'Main data flow', elements: [] },
    ],
  }),
  () => new Error('The references fixture does not parse.'),
);

describe('diagramsNamed', () => {
  it('selects the diagram whose id the name is', () => {
    expect(
      diagramsNamed(model.diagrams, 'diagram-main').map((one) => one.id),
    ).toEqual(['diagram-main']);
  });

  it('selects every diagram whose title the name is exactly', () => {
    expect(
      diagramsNamed(model.diagrams, 'Main data flow').map((one) => one.id),
    ).toEqual(['diagram-main', 'diagram-second']);
  });

  it('puts the diagram whose id the name is before one titled with it', () => {
    const titledFirst = Either.getOrThrowWith(
      parseModel({
        ...validModelFixture,
        diagrams: [
          { id: 'diagram-titled', title: 'diagram-main', elements: [] },
          ...validModelFixture.diagrams,
        ],
      }),
      () => new Error('The collision fixture does not parse.'),
    );
    expect(
      diagramsNamed(titledFirst.diagrams, 'diagram-main').map((one) => one.id),
    ).toEqual(['diagram-main', 'diagram-titled']);
  });

  it('selects nothing where the name is neither an id nor a title', () => {
    expect(diagramsNamed(model.diagrams, 'Main data')).toEqual([]);
  });

  it('selects nothing out of a model holding no diagram', () => {
    expect(diagramsNamed([], 'diagram-main')).toEqual([]);
  });
});
