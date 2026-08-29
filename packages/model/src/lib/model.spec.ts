import { diagramSchema, modelMetadataSchema, modelSchema } from './model.js';

const metadata = {
  title: 'Écluse',
  owner: 'Alexandra de Wit',
  description: 'STRIDE threat model for a supply-chain policy proxy.',
};

const actor = {
  kind: 'actor',
  id: '0ec10e5e-0000-4000-8000-000000000010',
  name: 'npm client (developer / CI)',
  position: { x: 10, y: 350 },
  size: { width: 170, height: 90 },
};

const flow = {
  kind: 'flow',
  id: '0ec10e5e-0000-4000-8000-000000000040',
  name: 'npm read / publish',
  source: {
    kind: 'attached',
    element: '0ec10e5e-0000-4000-8000-000000000010',
  },
  target: { kind: 'free', position: { x: 700, y: 400 } },
  waypoints: [],
};

const diagram = {
  id: 'diagram-high-level',
  title: 'High Level',
  elements: [actor, flow],
};

describe('modelMetadataSchema', () => {
  it('parses title, owner, and description', () => {
    expect(modelMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it('accepts an empty description', () => {
    expect(
      modelMetadataSchema.safeParse({ ...metadata, description: '' }).success,
    ).toBe(true);
  });
});

describe('diagramSchema', () => {
  it('parses a diagram owning mixed elements', () => {
    expect(diagramSchema.parse(diagram)).toEqual(diagram);
  });

  it('rejects an unknown key', () => {
    expect(
      diagramSchema.safeParse({ ...diagram, thumbnail: './x.jpg' }).success,
    ).toBe(false);
  });
});

describe('modelSchema', () => {
  it('parses metadata plus diagrams', () => {
    const model = { metadata, diagrams: [diagram] };
    expect(modelSchema.parse(model)).toEqual(model);
  });

  it('accepts duplicate element ids until the model-wide refinement lands (#19)', () => {
    const twice = { ...diagram, elements: [actor, actor] };
    expect(modelSchema.safeParse({ metadata, diagrams: [twice] }).success).toBe(
      true,
    );
  });

  it('rejects an unknown root key', () => {
    expect(
      modelSchema.safeParse({ metadata, diagrams: [], version: '2.6.2' })
        .success,
    ).toBe(false);
  });
});
