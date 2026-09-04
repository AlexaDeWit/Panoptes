import { elementSchema } from '@panoptes/model';
import {
  ecluseModel,
  everyGlyphModel,
  parsedFixture,
} from './canvas.fixtures.js';

const declaredKinds = new Set<string>(
  elementSchema.options.map((option) => option.shape.kind.value),
);

describe('parsedFixture', () => {
  it('names what a fixture lost when it stops parsing', () => {
    expect(() => parsedFixture({})).toThrow(/Fixture does not parse/u);
  });
});

describe('everyGlyphModel', () => {
  it('carries one element of every kind the model declares', () => {
    expect(
      new Set(
        everyGlyphModel.diagrams[0].elements.map((element) => element.kind),
      ),
    ).toEqual(declaredKinds);
  });

  it('read the kinds off the model schema, not off a list kept by hand', () => {
    expect(declaredKinds.size).toBeGreaterThan(1);
    expect(declaredKinds.has('actor')).toBe(true);
  });
});

describe('ecluseModel', () => {
  it('is the corpus the model and format suites read', () => {
    expect(ecluseModel.diagrams).toHaveLength(1);
    expect(ecluseModel.threats.length).toBeGreaterThan(0);
  });
});
