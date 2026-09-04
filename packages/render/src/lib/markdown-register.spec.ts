import {
  customCategorySchema,
  diagramSchema,
  parseModel,
  severitySchema,
  threatCategorySchema,
  threatSchema,
  threatStatusSchema,
  type Diagram,
  type Model,
  type Severity,
  type Threat,
  type ThreatCategory,
  type ThreatStatus,
} from '@panoptes/model';
import { Either } from 'effect';
import type { PhrasingContent } from 'mdast';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { renderRegister } from './markdown-register.js';

const repositoryRoot = join(import.meta.dirname, '../../../..');

const labelsPath = join(
  import.meta.dirname,
  'markdown-register.labels.snapshot.txt',
);

function committedModel(name: string): Model {
  return Either.getOrThrow(
    parseModel(JSON.parse(readFileSync(join(repositoryRoot, name), 'utf8'))),
  );
}

const ecluseModel: Model = committedModel('test-data/ecluse.model.json');

const registers: readonly {
  readonly name: string;
  readonly model: Model;
  readonly golden: string;
}[] = [
  {
    name: 'Écluse',
    model: ecluseModel,
    golden: join(
      repositoryRoot,
      'test-data/render/ecluse.register.snapshot.md',
    ),
  },
  {
    name: 'Panoptes',
    model: committedModel('test-data/panoptes.model.json'),
    golden: join(
      repositoryRoot,
      'test-data/render/panoptes.register.snapshot.md',
    ),
  },
];

const reader = unified().use(remarkParse).use(remarkGfm);

type ThreatFields = {
  readonly number: number;
  readonly title?: string;
  readonly category?: ThreatCategory;
  readonly severity?: Severity;
  readonly status?: ThreatStatus;
  readonly description?: string;
  readonly mitigation?: string;
  readonly elements?: readonly string[];
};

function threatOf(fields: ThreatFields): Threat {
  return threatSchema.parse({
    id: `threat-${fields.number}`,
    title: `Threat ${fields.number}`,
    category: { methodology: 'STRIDE', category: 'tampering' },
    severity: 'medium',
    status: 'open',
    description: '',
    mitigation: '',
    elements: [],
    ...fields,
  });
}

type CategoryVariant = (typeof threatCategorySchema)['options'][number];

type EnumeratedVariant = Exclude<CategoryVariant, typeof customCategorySchema>;

function isEnumerated(variant: CategoryVariant): variant is EnumeratedVariant {
  return variant !== customCategorySchema;
}

const everyCategory: readonly ThreatCategory[] = [
  ...threatCategorySchema.options.filter(isEnumerated).flatMap((variant) =>
    [...variant.shape.category.options].map((category) =>
      threatCategorySchema.parse({
        methodology: variant.shape.methodology.value,
        category,
      }),
    ),
  ),
  threatCategorySchema.parse({
    methodology: 'custom',
    methodologyName: 'OWASP LLM Top 10',
    category: 'Prompt injection',
  }),
];

const labelledMembers: readonly {
  readonly member: string;
  readonly column: number;
  readonly fields: Omit<ThreatFields, 'number'>;
}[] = [
  ...severitySchema.options.map((severity) => ({
    member: `severity ${severity}`,
    column: 4,
    fields: { severity },
  })),
  ...threatStatusSchema.options.map((status) => ({
    member: `status ${status}`,
    column: 5,
    fields: { status },
  })),
  ...everyCategory.map((category) => ({
    member: `category ${category.methodology} ${category.category}`,
    column: 3,
    fields: { category },
  })),
];

function diagramOf(
  id: string,
  elements: readonly { readonly id: string; readonly name: string }[],
): Diagram {
  return diagramSchema.parse({
    id,
    title: id,
    elements: elements.map((element) => ({
      kind: 'process',
      id: element.id,
      name: element.name,
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 60 },
    })),
  });
}

function modelOf(
  threats: readonly Threat[],
  diagrams: readonly Diagram[] = [],
  title = 'Sample',
): Model {
  return {
    metadata: { title, owner: '', description: '', contributors: [] },
    diagrams: [...diagrams],
    threats: [...threats],
    lastIssuedThreatNumber: Math.max(
      0,
      ...threats.map((threat) => threat.number),
    ),
    mitigations: [],
    assumptions: [],
  };
}

function textOf(nodes: readonly PhrasingContent[]): string {
  return nodes.map((node) => (node.type === 'text' ? node.value : '')).join('');
}

function headingsOf(
  document: string,
): { readonly depth: number; readonly text: string }[] {
  return reader
    .parse(document)
    .children.flatMap((node) =>
      node.type === 'heading'
        ? [{ depth: node.depth, text: textOf(node.children) }]
        : [],
    );
}

function tableRowsOf(document: string): string[][] {
  return reader
    .parse(document)
    .children.flatMap((node) =>
      node.type === 'table'
        ? node.children.map((row) =>
            row.children.map((cell) => textOf(cell.children)),
          )
        : [],
    );
}

function sectionsOf(document: string): string[] {
  return document.split(/^(?=## Threat )/m).slice(1);
}

describe.each(registers)('the $name register', ({ model, golden }) => {
  it('matches the golden file committed under test-data', async () => {
    await expect(renderRegister(model)).toMatchFileSnapshot(golden);
  });

  it('carries one section per threat, in number order', () => {
    const numbers = model.threats.map((threat) => threat.number);
    numbers.sort((left, right) => left - right);
    expect(
      headingsOf(renderRegister(model))
        .filter((entry) => entry.depth === 2)
        .map((entry) => entry.text),
    ).toEqual(
      numbers.map((number) => {
        const threat = model.threats.find(
          (candidate) => candidate.number === number,
        );
        return `Threat ${number}: ${threat?.title ?? ''}`;
      }),
    );
  });

  it('carries one overview row per threat, under the six column headings', () => {
    const rows = tableRowsOf(renderRegister(model));
    expect(rows[0]).toEqual([
      'Number',
      'Title',
      'Elements',
      'Category',
      'Severity',
      'Status',
    ]);
    expect(rows.length).toBe(model.threats.length + 1);
  });
});

describe('the register document', () => {
  it('titles itself after the model', () => {
    expect(headingsOf(renderRegister(modelOf([])))[0]).toEqual({
      depth: 1,
      text: 'Sample threat register',
    });
  });

  it('titles itself bare where the model carries no title', () => {
    expect(headingsOf(renderRegister(modelOf([], [], '')))[0]).toEqual({
      depth: 1,
      text: 'Threat register',
    });
  });

  it('keeps its title on one line where the model title carries a break', () => {
    expect(
      headingsOf(renderRegister(modelOf([], [], 'Two\nlines')))[0],
    ).toEqual({ depth: 1, text: 'Two lines threat register' });
  });

  it('states that a model holding no threats records none, and writes no table', () => {
    const rendered = renderRegister(modelOf([]));
    expect(rendered).toContain('This model records no threats.');
    expect(tableRowsOf(rendered)).toEqual([]);
  });
});

describe('a threat section', () => {
  it('leads its heading with the number, then the title', () => {
    const rendered = renderRegister(
      modelOf([threatOf({ number: 7, title: 'Token replay' })]),
    );
    expect(headingsOf(rendered)).toContainEqual({
      depth: 2,
      text: 'Threat 7: Token replay',
    });
  });

  it('keeps its heading where the title ends in a line break', () => {
    const rendered = renderRegister(
      modelOf([threatOf({ number: 1, title: 'Token replay\n' })]),
    );
    expect(headingsOf(rendered).filter((entry) => entry.depth === 2)).toEqual([
      { depth: 2, text: 'Threat 1: Token replay' },
    ]);
  });

  it('keeps its heading where the title opens on a line break', () => {
    const rendered = renderRegister(
      modelOf([threatOf({ number: 1, title: '\nToken replay' })]),
    );
    expect(headingsOf(rendered).filter((entry) => entry.depth === 2)).toEqual([
      { depth: 2, text: 'Threat 1: Token replay' },
    ]);
  });

  it('cannot forge another threat heading from a line inside a title', () => {
    const rendered = renderRegister(
      modelOf([
        threatOf({
          number: 1,
          title: 'x\n\nThreat 2: Someone elses title',
        }),
        threatOf({ number: 2, title: 'The real second threat' }),
      ]),
    );
    expect(headingsOf(rendered).filter((entry) => entry.depth === 2)).toEqual([
      { depth: 2, text: 'Threat 1: x Threat 2: Someone elses title' },
      { depth: 2, text: 'Threat 2: The real second threat' },
    ]);
  });

  it('gives two titles sharing a trailing line two headings of their own', () => {
    const rendered = renderRegister(
      modelOf([
        threatOf({ number: 1, title: 'first\nShared tail' }),
        threatOf({ number: 2, title: 'second\nShared tail' }),
      ]),
    );
    expect(headingsOf(rendered).filter((entry) => entry.depth === 2)).toEqual([
      { depth: 2, text: 'Threat 1: first Shared tail' },
      { depth: 2, text: 'Threat 2: second Shared tail' },
    ]);
  });

  it('lists the fields of the threat under the heading', () => {
    const rendered = renderRegister(
      modelOf(
        [
          threatOf({
            number: 1,
            severity: 'critical',
            status: 'accepted-risk',
            elements: ['el-a'],
          }),
        ],
        [diagramOf('d0', [{ id: 'el-a', name: 'Gateway' }])],
      ),
    );
    expect(rendered).toContain('- **Elements**: Gateway');
    expect(rendered).toContain('- **Category**: Tampering (STRIDE)');
    expect(rendered).toContain('- **Severity**: Critical');
    expect(rendered).toContain('- **Status**: Accepted risk');
  });

  it('names every element the threat attaches to, across diagrams', () => {
    const rendered = renderRegister(
      modelOf(
        [threatOf({ number: 1, elements: ['el-a', 'el-b'] })],
        [
          diagramOf('d0', [{ id: 'el-a', name: 'Gateway' }]),
          diagramOf('d1', [{ id: 'el-b', name: 'Ledger' }]),
        ],
      ),
    );
    expect(rendered).toContain('- **Elements**: Gateway, Ledger');
  });

  it('says None where the threat attaches to no element', () => {
    expect(renderRegister(modelOf([threatOf({ number: 1 })]))).toContain(
      '- **Elements**: None',
    );
  });

  it('falls back to the element id where the element has no name', () => {
    const rendered = renderRegister(
      modelOf(
        [threatOf({ number: 1, elements: ['el-a'] })],
        [diagramOf('d0', [{ id: 'el-a', name: '' }])],
      ),
    );
    expect(rendered).toContain('- **Elements**: el-a');
  });

  it('falls back to the element id where the reference resolves to nothing', () => {
    const rendered = renderRegister(
      modelOf([threatOf({ number: 1, elements: ['el-gone'] })]),
    );
    expect(rendered).toContain('- **Elements**: el-gone');
  });

  it('says None recorded where the threat carries neither prose', () => {
    const rendered = renderRegister(modelOf([threatOf({ number: 1 })]));
    expect(rendered).toContain('**Description**\n\nNone recorded.');
    expect(rendered).toContain('**Mitigation**\n\nNone recorded.');
  });

  it('labels every severity, status and category the model declares', async () => {
    const rendered = renderRegister(
      modelOf(
        labelledMembers.map((entry, index) =>
          threatOf({ number: index + 1, ...entry.fields }),
        ),
      ),
    );
    const rows = tableRowsOf(rendered).slice(1);
    expect(rows.length).toBe(labelledMembers.length);
    const listing = labelledMembers
      .map((entry, index) => `${entry.member}: ${rows[index][entry.column]}`)
      .join('\n');
    await expect(`${listing}\n`).toMatchFileSnapshot(labelsPath);
  });
});

describe('threat prose', () => {
  it('splices the markdown of a description in as nodes', () => {
    const rendered = renderRegister(
      modelOf([
        threatOf({
          number: 1,
          description: 'A list:\n\n* one\n* two',
          mitigation: 'A [link](https://example.invalid).',
        }),
      ]),
    );
    expect(rendered).toContain('- one\n- two');
    expect(rendered).toContain('A [link](https://example.invalid).');
  });

  it('demotes a heading inside prose below the section heading', () => {
    const rendered = renderRegister(
      modelOf([
        threatOf({
          number: 1,
          description: '# Attack path\n\nText.',
          mitigation: '###### Deep\n\nText.',
        }),
      ]),
    );
    expect(headingsOf(rendered).map((entry) => entry.depth)).toEqual([
      1, 2, 3, 6,
    ]);
    expect(headingsOf(rendered)[2]).toEqual({ depth: 3, text: 'Attack path' });
  });

  it('renders prose nested past the depth bound as the text the author wrote', () => {
    const rendered = renderRegister(
      modelOf([
        threatOf({ number: 1, description: `${'> '.repeat(4000)}too deep` }),
      ]),
    );
    expect(typeof rendered).toBe('string');
    expect(rendered).toContain('too deep');
  });

  it('passes raw HTML in prose through unchanged', () => {
    const rendered = renderRegister(
      modelOf([
        threatOf({
          number: 1,
          description: 'Set <span data-role="note">the flag</span> first.',
        }),
      ]),
    );
    expect(rendered).toContain('Set <span data-role="note">the flag</span>');
  });
});

describe('a hostile threat title', () => {
  const title = '# Pipe | backtick ` asterisk * end';
  const rendered = renderRegister(modelOf([threatOf({ number: 1, title })]));

  it('reaches the heading as the text the author wrote', () => {
    expect(headingsOf(rendered)).toContainEqual({
      depth: 2,
      text: `Threat 1: ${title}`,
    });
  });

  it('reaches the overview table as the text the author wrote', () => {
    expect(tableRowsOf(rendered)[1]?.[1]).toBe(title);
  });

  it('is escaped rather than carried through raw', () => {
    expect(rendered).toContain('\\|');
    expect(rendered).toContain('\\`');
    expect(rendered).toContain('\\*');
  });
});

describe('a register render', () => {
  it('writes the same bytes twice for the same model', () => {
    expect(renderRegister(ecluseModel)).toBe(renderRegister(ecluseModel));
  });

  it('writes the same bytes whatever order the threats arrive in', () => {
    const threats = [
      threatOf({ number: 3 }),
      threatOf({ number: 1 }),
      threatOf({ number: 2 }),
    ];
    const sorted = [...threats];
    sorted.sort((left, right) => left.number - right.number);
    expect(renderRegister(modelOf(threats))).toBe(
      renderRegister(modelOf(sorted)),
    );
  });

  it('leaves every existing section byte-identical when a higher-numbered threat is added', () => {
    const existing = [threatOf({ number: 1 }), threatOf({ number: 2 })];
    const before = sectionsOf(renderRegister(modelOf(existing)));
    const after = sectionsOf(
      renderRegister(modelOf([...existing, threatOf({ number: 3 })])),
    );
    expect(after.slice(0, before.length).join('').trimEnd()).toBe(
      before.join('').trimEnd(),
    );
    expect(after.length).toBe(before.length + 1);
  });

  it('leaves the heading of every surviving threat unmoved when one is removed', () => {
    const existing = [
      threatOf({ number: 1 }),
      threatOf({ number: 2 }),
      threatOf({ number: 3 }),
    ];
    const headingsBefore = headingsOf(renderRegister(modelOf(existing))).filter(
      (entry) => entry.depth === 2,
    );
    const headingsAfter = headingsOf(
      renderRegister(modelOf([existing[0], existing[2]])),
    ).filter((entry) => entry.depth === 2);
    expect(headingsAfter).toEqual([headingsBefore[0], headingsBefore[2]]);
  });
});
