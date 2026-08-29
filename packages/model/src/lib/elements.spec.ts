import {
  actorSchema,
  boundaryShapeSchema,
  elementSchema,
  flowEndpointSchema,
  flowSchema,
  processSchema,
  storeSchema,
  trustBoundarySchema,
} from './elements.js';

// Samples taken from Écluse's Threat Dragon diagram, the representability
// target: real cell ids, names, and geometry.
const actor = {
  kind: 'actor',
  id: '0ec10e5e-0000-4000-8000-000000000010',
  name: 'npm client (developer / CI)',
  position: { x: 10, y: 350 },
  size: { width: 170, height: 90 },
};

const process = {
  kind: 'process',
  id: '0ec10e5e-0000-4000-8000-000000000020',
  name: 'Écluse proxy',
  position: { x: 530, y: 475 },
  size: { width: 130, height: 130 },
};

const store = {
  kind: 'store',
  id: '0ec10e5e-0000-4000-8000-000000000030',
  name: 'Metadata cache (public-gated only)',
  position: { x: 360, y: 110 },
  size: { width: 180, height: 90 },
};

const attachedFlow = {
  kind: 'flow',
  id: '0ec10e5e-0000-4000-8000-000000000040',
  name: 'npm read / publish (passthrough CodeArtifact token)',
  source: {
    kind: 'attached',
    element: '0ec10e5e-0000-4000-8000-000000000010',
  },
  target: {
    kind: 'attached',
    element: '0ec10e5e-0000-4000-8000-000000000020',
  },
  waypoints: [],
};

// Écluse's flow whose source is a bare point on the canvas, the case the
// free endpoint variant exists for.
const freeSourceFlow = {
  kind: 'flow',
  id: '4e565871-45cc-4987-abba-24859ee2cf60',
  name: 'OSV Dataset for Supported Registries',
  source: { kind: 'free', position: { x: 1480, y: 860 } },
  target: {
    kind: 'attached',
    element: 'f1646094-9885-422a-b7e7-7888c72905ef',
  },
  waypoints: [{ x: 1300, y: 900 }],
};

const boundaryBox = {
  kind: 'trust-boundary',
  id: '0ec10e5e-0000-4000-8000-000000000001',
  name: 'Operator trust zone (VPC / mesh): access edge enforced here',
  shape: {
    kind: 'box',
    position: { x: 240, y: 10 },
    size: { width: 1180, height: 1180 },
  },
};

// Écluse has no boundary curves; Threat Dragon draws them, so the model
// carries the variant from the start.
const boundaryCurve = {
  kind: 'trust-boundary',
  id: 'internet-edge',
  name: 'Internet edge',
  shape: {
    kind: 'curve',
    waypoints: [
      { x: 0, y: 120 },
      { x: 300, y: 80 },
      { x: 620, y: 140 },
    ],
  },
};

describe('actorSchema', () => {
  it('parses an Écluse actor', () => {
    expect(actorSchema.parse(actor)).toEqual(actor);
  });

  it('rejects a missing size', () => {
    const { size: _size, ...rest } = actor;
    expect(actorSchema.safeParse(rest).success).toBe(false);
  });
});

describe('processSchema', () => {
  it('parses an Écluse process', () => {
    expect(processSchema.parse(process)).toEqual(process);
  });
});

describe('storeSchema', () => {
  it('parses an Écluse store', () => {
    expect(storeSchema.parse(store)).toEqual(store);
  });
});

describe('flowEndpointSchema', () => {
  it('parses an attached endpoint', () => {
    expect(
      flowEndpointSchema.safeParse({ kind: 'attached', element: 'a' }).success,
    ).toBe(true);
  });

  it('parses a free endpoint', () => {
    expect(
      flowEndpointSchema.safeParse({
        kind: 'free',
        position: { x: 0, y: 0 },
      }).success,
    ).toBe(true);
  });

  it('rejects an endpoint without a kind tag', () => {
    expect(flowEndpointSchema.safeParse({ element: 'a' }).success).toBe(false);
  });

  it('rejects an attached endpoint carrying a position', () => {
    expect(
      flowEndpointSchema.safeParse({
        kind: 'attached',
        element: 'a',
        position: { x: 0, y: 0 },
      }).success,
    ).toBe(false);
  });
});

describe('flowSchema', () => {
  it('parses a flow attached at both ends', () => {
    expect(flowSchema.parse(attachedFlow)).toEqual(attachedFlow);
  });

  it('parses the free-source flow from Écluse', () => {
    expect(flowSchema.parse(freeSourceFlow)).toEqual(freeSourceFlow);
  });

  it('rejects a flow without waypoints', () => {
    const { waypoints: _waypoints, ...rest } = attachedFlow;
    expect(flowSchema.safeParse(rest).success).toBe(false);
  });
});

describe('boundaryShapeSchema', () => {
  it('parses a box', () => {
    expect(boundaryShapeSchema.safeParse(boundaryBox.shape).success).toBe(true);
  });

  it('parses a curve', () => {
    expect(boundaryShapeSchema.safeParse(boundaryCurve.shape).success).toBe(
      true,
    );
  });

  it('rejects an unknown shape kind', () => {
    expect(
      boundaryShapeSchema.safeParse({
        kind: 'blob',
        position: { x: 0, y: 0 },
      }).success,
    ).toBe(false);
  });
});

describe('trustBoundarySchema', () => {
  it('parses a box boundary', () => {
    expect(trustBoundarySchema.parse(boundaryBox)).toEqual(boundaryBox);
  });

  it('parses a curve boundary', () => {
    expect(trustBoundarySchema.parse(boundaryCurve)).toEqual(boundaryCurve);
  });

  it('rejects a box shape without a size', () => {
    expect(
      trustBoundarySchema.safeParse({
        ...boundaryBox,
        shape: { kind: 'box', position: { x: 240, y: 10 } },
      }).success,
    ).toBe(false);
  });
});

describe('elementSchema', () => {
  const samples = [
    actor,
    process,
    store,
    attachedFlow,
    freeSourceFlow,
    boundaryBox,
    boundaryCurve,
  ];

  it('parses every element kind and keeps its kind tag', () => {
    for (const sample of samples) {
      expect(elementSchema.parse(sample).kind).toBe(sample.kind);
    }
  });

  it('rejects an unknown element kind', () => {
    expect(elementSchema.safeParse({ ...actor, kind: 'cloud' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown key instead of dropping it', () => {
    expect(elementSchema.safeParse({ ...actor, zIndex: 1 }).success).toBe(
      false,
    );
  });
});
