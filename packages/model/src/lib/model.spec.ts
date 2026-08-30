import { diagramSchema, modelMetadataSchema, modelSchema } from './model.js';

const metadata = {
  title: 'Écluse',
  owner: 'Alexandra de Wit',
  description: 'STRIDE threat model for a supply-chain policy proxy.',
  contributors: ['Alexandra de Wit'],
};

const actor = {
  kind: 'actor',
  id: '0ec10e5e-0000-4000-8000-000000000010',
  name: 'npm client (developer / CI)',
  description: 'The caller. It presents its own CodeArtifact bearer token.',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 10, y: 350 },
  size: { width: 170, height: 90 },
};

const flow = {
  kind: 'flow',
  id: '0ec10e5e-0000-4000-8000-000000000040',
  name: 'npm read / publish',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
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

const threat = {
  id: 'c87367bd-fc3f-4792-94b6-8db459011823',
  number: 101,
  title: 'Oracle Blackout / Supply Chain DoS via OSV.dev compromise',
  category: { methodology: 'STRIDE', category: 'spoofing' },
  severity: 'high',
  status: 'accepted-risk',
  description:
    'An attacker who gains control of osv.dev can push malicious ' +
    'vulnerability records.',
  mitigation: 'Risk treatment: accepted by trust assumption.',
  elements: ['f1646094-9885-422a-b7e7-7888c72905ef'],
};

const mitigation = {
  id: 'last-good-database',
  title: 'Last-good-database fallback',
  prose:
    'Transport, parsing, and validation controls with a kept last-good db.',
  status: 'implemented',
  threats: ['c87367bd-fc3f-4792-94b6-8db459011823'],
};

const assumption = {
  id: 'osv-is-trusted',
  prose: 'Écluse trusts the OSV database as the oracle of vulnerability truth.',
  status: 'valid',
  elements: ['f1646094-9885-422a-b7e7-7888c72905ef'],
  threats: ['c87367bd-fc3f-4792-94b6-8db459011823'],
};

const emptyRecords = {
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};

describe('modelMetadataSchema', () => {
  it('parses title, owner, description, and contributors', () => {
    expect(modelMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it('accepts an empty description', () => {
    expect(
      modelMetadataSchema.safeParse({ ...metadata, description: '' }).success,
    ).toBe(true);
  });

  it('accepts a model no one has been credited on yet', () => {
    expect(
      modelMetadataSchema.safeParse({ ...metadata, contributors: [] }).success,
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
  it('parses metadata, diagrams, threats, mitigations, and assumptions', () => {
    const model = {
      metadata,
      diagrams: [diagram],
      threats: [threat],
      lastIssuedThreatNumber: 101,
      mitigations: [mitigation],
      assumptions: [assumption],
    };
    expect(modelSchema.parse(model)).toEqual(model);
  });

  it('accepts empty diagrams, elements, and record arrays', () => {
    expect(
      modelSchema.safeParse({ metadata, diagrams: [], ...emptyRecords })
        .success,
    ).toBe(true);
    expect(
      modelSchema.safeParse({
        metadata,
        diagrams: [{ ...diagram, elements: [] }],
        ...emptyRecords,
      }).success,
    ).toBe(true);
  });

  it("accepts duplicate element ids: model-wide uniqueness is parseModel's refinement", () => {
    const twice = { ...diagram, elements: [actor, actor] };
    expect(
      modelSchema.safeParse({ metadata, diagrams: [twice], ...emptyRecords })
        .success,
    ).toBe(true);
  });

  it("accepts duplicate threat numbers: model-wide uniqueness is parseModel's refinement", () => {
    const twin = { ...threat, id: 'another-threat' };
    expect(
      modelSchema.safeParse({
        metadata,
        diagrams: [],
        ...emptyRecords,
        threats: [threat, twin],
      }).success,
    ).toBe(true);
  });

  it("accepts a last issued number below a threat it holds: the ceiling is parseModel's refinement", () => {
    expect(
      modelSchema.safeParse({
        metadata,
        diagrams: [],
        ...emptyRecords,
        threats: [threat],
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown root key', () => {
    expect(
      modelSchema.safeParse({
        metadata,
        diagrams: [],
        ...emptyRecords,
        version: '2.6.2',
      }).success,
    ).toBe(false);
  });
});
