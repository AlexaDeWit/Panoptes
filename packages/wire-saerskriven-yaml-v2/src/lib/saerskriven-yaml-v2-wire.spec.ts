import {
  saerskrivenYamlV2WireSchema,
  type SaerskrivenYamlV2AssumptionStatus,
  type SaerskrivenYamlV2Document,
} from './saerskriven-yaml-v2-wire.js';

const document: SaerskrivenYamlV2Document = {
  formatVersion: 2,
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
      elements: ['element-1'],
    },
  ],
  lastIssuedThreatNumber: 1,
  mitigations: [
    {
      id: 'mitigation-1',
      title: 'Mutual TLS',
      prose: '',
      status: 'proposed',
      threats: ['threat-1'],
    },
  ],
  assumptions: [
    {
      id: 'assumption-1',
      prose: 'Callers sit behind the gateway.',
      status: 'unconfirmed',
      threats: ['threat-1'],
    },
  ],
};

function parsedOf(value: unknown) {
  const result = saerskrivenYamlV2WireSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function issuePathsOf(value: unknown) {
  const result = saerskrivenYamlV2WireSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

describe('the Saerskriven YAML version 2 wire schema', () => {
  it('reads a file of the release it declares', () => {
    expect(parsedOf(document)).toEqual(document);
  });

  it('refuses a version 1 file, at that path', () => {
    expect(issuePathsOf({ ...document, formatVersion: 1 })).toEqual([
      ['formatVersion'],
    ]);
  });

  it('drops the threat mitigation text and the assumption element links', () => {
    expect(
      parsedOf({
        ...document,
        threats: [{ ...document.threats[0], mitigation: 'Mutual TLS' }],
        assumptions: [{ ...document.assumptions[0], elements: ['element-1'] }],
      }),
    ).toEqual(document);
  });

  it.each<SaerskrivenYamlV2AssumptionStatus>([
    'unconfirmed',
    'valid',
    'invalidated',
  ])('reads an assumption that is %s', (status) => {
    const assumptions = [{ ...document.assumptions[0], status }];
    expect(parsedOf({ ...document, assumptions })).toEqual({
      ...document,
      assumptions,
    });
  });
});
