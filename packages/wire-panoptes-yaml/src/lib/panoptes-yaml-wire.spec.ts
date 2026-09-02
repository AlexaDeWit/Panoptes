import {
  panoptesYamlWireSchema,
  type PanoptesYamlDocument,
} from './panoptes-yaml-wire.js';

const document: PanoptesYamlDocument = {
  formatVersion: 1,
  metadata: {
    title: 'One threat',
    owner: '',
    description: '',
    contributors: [],
  },
  diagrams: [
    {
      id: 'diagram-1',
      title: 'Only',
      elements: [
        {
          kind: 'process',
          id: 'element-1',
          name: 'Gateway',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
        },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-1',
      number: 1,
      title: 'Spoofed caller',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'high',
      status: 'open',
      description: '',
      mitigation: '',
      elements: ['element-1'],
    },
  ],
  lastIssuedThreatNumber: 1,
  mitigations: [],
  assumptions: [],
};

function parsedOf(value: unknown) {
  const result = panoptesYamlWireSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function issuePathsOf(value: unknown) {
  const result = panoptesYamlWireSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

describe('the Panoptes YAML wire schema', () => {
  it('reads a file of the release it declares', () => {
    expect(parsedOf(document)).toEqual(document);
  });

  it('refuses a file that names no release, at that path', () => {
    const { formatVersion: _formatVersion, ...unstamped } = document;
    expect(issuePathsOf(unstamped)).toEqual([['formatVersion']]);
  });

  it('refuses a file stamped with another release, at that path', () => {
    expect(issuePathsOf({ ...document, formatVersion: 2 })).toEqual([
      ['formatVersion'],
    ]);
  });

  it('refuses a file that leaves out something it declares', () => {
    const { threats: _threats, ...withoutThreats } = document;
    expect(issuePathsOf(withoutThreats)).toEqual([['threats']]);
  });

  it('drops what it does not declare rather than refusing the file', () => {
    expect(
      parsedOf({
        ...document,
        notes: 'kept nowhere',
        threats: [{ ...document.threats[0], likelihood: 'high' }],
      }),
    ).toEqual(document);
  });
});
