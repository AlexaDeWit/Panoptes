import { Either } from 'effect';
import * as api from '../index.js';
import { validModelFixture } from './fixtures.js';
import { parseModel } from './parse.js';

const seeded = (mutate: (draft: typeof validModelFixture) => void) => {
  const draft = structuredClone(validModelFixture);
  mutate(draft);
  return parseModel(draft);
};

const issuesOf = (result: ReturnType<typeof parseModel>) =>
  Either.isLeft(result) ? result.left.issues : [];

describe('parseModel', () => {
  it('parses the committed valid fixture', () => {
    expect(Either.getOrNull(parseModel(validModelFixture))).toEqual(
      validModelFixture,
    );
  });

  it('reports violations through the same Either as plain tagged data', () => {
    const result = parseModel({ ...validModelFixture, version: '2.6.2' });
    expect(Either.isLeft(result) && result.left._tag).toBe('InvalidModel');
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({ code: 'unrecognized_keys', path: [] }),
    );
  });

  it('serializes a failure to its plain tagged shape', () => {
    const result = parseModel({ ...validModelFixture, version: '2.6.2' });
    if (Either.isRight(result)) {
      throw new Error('The invalid input must fail to parse.');
    }
    expect(JSON.parse(JSON.stringify(result.left))).toEqual({
      _tag: 'InvalidModel',
      issues: result.left.issues,
    });
  });

  it('rejects a duplicate element id across diagrams', () => {
    const result = seeded((draft) => {
      draft.diagrams.push({
        id: 'diagram-second',
        title: 'Second',
        elements: [structuredClone(draft.diagrams[0].elements[0])],
      });
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 1, 'elements', 0, 'id'],
        message:
          'Duplicate element id "element-customer": element ids must be unique across the model.',
      }),
    );
  });

  it('rejects a duplicate diagram id', () => {
    const result = seeded((draft) => {
      draft.diagrams.push({ id: 'diagram-main', title: 'Copy', elements: [] });
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 1, 'id'],
        message:
          'Duplicate diagram id "diagram-main": diagram ids must be unique across the model.',
      }),
    );
  });

  it('rejects a duplicate threat number', () => {
    const result = seeded((draft) => {
      draft.threats.push({
        ...structuredClone(draft.threats[0]),
        id: 'threat-second',
      });
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['threats', 1, 'number'],
        message:
          'Duplicate threat number 1: threat numbers must be unique across the model.',
      }),
    );
  });

  it('rejects a duplicate threat id', () => {
    const result = seeded((draft) => {
      draft.threats.push({ ...structuredClone(draft.threats[0]), number: 2 });
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['threats', 1, 'id'],
        message:
          'Duplicate threat id "threat-tamper-order": threat ids must be unique among threats.',
      }),
    );
  });

  it('rejects a duplicate mitigation id', () => {
    const result = seeded((draft) => {
      draft.mitigations.push(structuredClone(draft.mitigations[0]));
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['mitigations', 1, 'id'],
        message:
          'Duplicate mitigation id "mitigation-tls": mitigation ids must be unique among mitigations.',
      }),
    );
  });

  it('rejects a duplicate assumption id', () => {
    const result = seeded((draft) => {
      draft.assumptions.push(structuredClone(draft.assumptions[0]));
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['assumptions', 1, 'id'],
        message:
          'Duplicate assumption id "assumption-managed-db": assumption ids must be unique among assumptions.',
      }),
    );
  });

  it('rejects a flow anchored outside its own diagram', () => {
    const result = seeded((draft) => {
      draft.diagrams.push({
        id: 'diagram-second',
        title: 'Second',
        elements: [
          {
            ...structuredClone(draft.diagrams[0].elements[1]),
            id: 'element-remote',
          },
        ],
      });
      for (const element of draft.diagrams[0].elements) {
        if (element.kind === 'flow') {
          element.source = { kind: 'attached', element: 'element-remote' };
        }
      }
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 3, 'source', 'element'],
        message:
          'Flow source references element id "element-remote", which is not in the flow\'s own diagram.',
      }),
    );
  });

  it('rejects a flow anchored to itself', () => {
    const result = seeded((draft) => {
      for (const element of draft.diagrams[0].elements) {
        if (element.kind === 'flow') {
          element.target = { kind: 'attached', element: element.id };
        }
      }
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 3, 'target', 'element'],
        message:
          'Flow target references the flow\'s own id "element-order-flow": a flow cannot anchor to itself.',
      }),
    );
  });

  it('rejects a threat attachment naming an unknown element', () => {
    const result = seeded((draft) => {
      draft.threats[0].elements.push('element-ghost');
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['threats', 0, 'elements', 2],
        message:
          'Threat elements references unknown element id "element-ghost".',
      }),
    );
  });

  it('rejects an assumption naming an unknown element', () => {
    const result = seeded((draft) => {
      draft.assumptions[0].elements.push('element-ghost');
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['assumptions', 0, 'elements', 1],
        message:
          'Assumption elements references unknown element id "element-ghost".',
      }),
    );
  });

  it('rejects a mitigation naming an unknown threat', () => {
    const result = seeded((draft) => {
      draft.mitigations[0].threats.push('threat-ghost');
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['mitigations', 0, 'threats', 1],
        message:
          'Mitigation threats references unknown threat id "threat-ghost".',
      }),
    );
  });

  it('rejects an assumption naming an unknown threat', () => {
    const result = seeded((draft) => {
      draft.assumptions[0].threats.push('threat-ghost');
    });
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({
        path: ['assumptions', 0, 'threats', 1],
        message:
          'Assumption threats references unknown threat id "threat-ghost".',
      }),
    );
  });

  it('surfaces multiple violations in one parse', () => {
    const result = seeded((draft) => {
      draft.diagrams.push({ id: 'diagram-main', title: 'Copy', elements: [] });
      draft.threats[0].elements.push('element-ghost');
    });
    expect(issuesOf(result)).toHaveLength(2);
  });
});

describe('package surface', () => {
  it('exports parseModel and keeps the structural model schema internal', () => {
    expect(typeof api.parseModel).toBe('function');
    expect('modelSchema' in api).toBe(false);
  });
});
