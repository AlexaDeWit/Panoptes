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

const actor = {
  kind: 'actor',
  id: '0ec10e5e-0000-4000-8000-000000000010',
  name: 'npm client (developer / CI)',
  description:
    'The caller. It presents its own CodeArtifact bearer token. The ' +
    "operator's access edge authenticates it to the proxy, not Écluse.",
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 10, y: 350 },
  size: { width: 170, height: 90 },
};

const process = {
  kind: 'process',
  id: '0ec10e5e-0000-4000-8000-000000000020',
  name: 'Écluse proxy',
  description:
    'The request pipeline: router, parallel upstream fetch, packument ' +
    'merge, deny-by-default rules and integrity gate, then serve. It ' +
    'relays publishes. It holds forwarded caller credentials transiently. ' +
    'It polls S3 for OSV db updates and performs an atomic shadow-swap ' +
    'for CVE boundaries.',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 530, y: 475 },
  size: { width: 130, height: 130 },
};

const store = {
  kind: 'store',
  id: '0ec10e5e-0000-4000-8000-000000000030',
  name: 'Metadata cache (public-gated only)',
  description:
    'The shared in-proxy cache. It holds only the anonymous public gated ' +
    'origin. Écluse never enters the per-caller private origin, under any ' +
    'strategy.',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 360, y: 110 },
  size: { width: 180, height: 90 },
};

const attachedFlow = {
  kind: 'flow',
  id: '0ec10e5e-0000-4000-8000-000000000040',
  name: 'npm read / publish (passthrough CodeArtifact token)',
  description:
    "The caller's request, carrying its own CodeArtifact bearer token. It " +
    'crosses the operator access edge.',
  outOfScope: false,
  reasonOutOfScope: '',
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

const freeSourceFlow = {
  kind: 'flow',
  id: '4e565871-45cc-4987-abba-24859ee2cf60',
  name: 'OSV Dataset for Supported Registries',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
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
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  shape: {
    kind: 'box',
    position: { x: 240, y: 10 },
    size: { width: 1180, height: 1180 },
  },
};

const boundaryCurve = {
  kind: 'trust-boundary',
  id: 'internet-edge',
  name: 'Internet edge',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
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

  it('accepts the empty string as a name', () => {
    expect(actorSchema.safeParse({ ...actor, name: '' }).success).toBe(true);
  });

  it('accepts an out-of-scope element carrying its reason', () => {
    expect(
      actorSchema.safeParse({
        ...actor,
        outOfScope: true,
        reasonOutOfScope: 'Authenticated by the operator access edge.',
      }).success,
    ).toBe(true);
  });

  it('ties the scoping pair by convention only: either field stands alone', () => {
    expect(actorSchema.safeParse({ ...actor, outOfScope: true }).success).toBe(
      true,
    );
    expect(
      actorSchema.safeParse({
        ...actor,
        reasonOutOfScope: 'Out of the operator trust zone.',
      }).success,
    ).toBe(true);
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
      flowEndpointSchema.safeParse({ kind: 'attached', element: 'api' })
        .success,
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

  it('rejects a curve with fewer than two waypoints', () => {
    expect(
      boundaryShapeSchema.safeParse({
        kind: 'curve',
        waypoints: [{ x: 0, y: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe('trustBoundarySchema', () => {
  it('parses a box boundary', () => {
    expect(trustBoundarySchema.parse(boundaryBox)).toEqual(boundaryBox);
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
});
