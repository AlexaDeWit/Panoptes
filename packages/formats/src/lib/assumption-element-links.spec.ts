import { assumptionId } from '@saerskriven/model/fixtures';
import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import {
  droppedAssumptionElementLinks,
  withoutAssumptionElementLinks,
} from './assumption-element-links.js';

const assumption = (id: string, elements: string[]) => ({
  id,
  prose: 'The ledger is append only.',
  status: 'valid' as const,
  elements,
  threats: ['threat-1'],
});

const document: SaerskrivenYamlDocument = {
  formatVersion: 1,
  metadata: { title: 'Linked', owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [
    assumption('assumption-linked', ['element-1', 'element-2']),
    assumption('assumption-unlinked', []),
    assumption('a', ['element-1']),
  ],
};

describe('droppedAssumptionElementLinks', () => {
  it('names each assumption that held element links, from the document alone, and skips one whose id the model refuses', () => {
    expect(droppedAssumptionElementLinks(document)).toEqual([
      expect.objectContaining({
        subject: {
          kind: 'assumption',
          id: assumptionId('assumption-linked'),
        },
        reason: 'narrowed',
      }),
    ]);
  });
});

describe('withoutAssumptionElementLinks', () => {
  it('empties every element list and keeps the threat links', () => {
    expect(
      withoutAssumptionElementLinks(document).assumptions.map(
        ({ elements, threats }) => ({ elements, threats }),
      ),
    ).toEqual(
      document.assumptions.map(() => ({ elements: [], threats: ['threat-1'] })),
    );
  });
});
