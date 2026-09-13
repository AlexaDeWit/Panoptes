import {
  assumptionSchema,
  assumptionStatusSchema,
  customCategorySchema,
  diagramSchema,
  mitigationSchema,
  mitigationStatusSchema,
  parseModel,
  severitySchema,
  threatCategorySchema,
  threatFlagSchema,
  threatSchema,
  threatStatusSchema,
  type Assumption,
  type Diagram,
  type Mitigation,
  type Model,
  type Severity,
  type Threat,
  type ThreatCategory,
  type ThreatStatus,
} from '@saerskriven/model';
import { Either } from 'effect';
import type { RegisterBadge } from '@saerskriven/canvas';
import type { ListItem, Root, RootContent, Strong } from 'mdast';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { renderRegister } from './markdown-register.js';
import { registerDocument } from './register-tree.js';

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
    name: 'Saerskriven',
    model: committedModel('test-data/saerskriven.model.json'),
    golden: join(
      repositoryRoot,
      'test-data/render/saerskriven.register.snapshot.md',
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

type RecordFields = {
  readonly id: string;
  readonly threats: readonly string[];
  readonly prose?: string;
};

function mitigationOf(
  fields: RecordFields & {
    readonly title?: string;
    readonly status?: Mitigation['status'];
  },
): Mitigation {
  return mitigationSchema.parse({
    title: '',
    prose: '',
    status: 'proposed',
    ...fields,
  });
}

function assumptionOf(
  fields: RecordFields & { readonly status?: Assumption['status'] },
): Assumption {
  return assumptionSchema.parse({
    prose: '',
    status: 'unconfirmed',
    elements: [],
    ...fields,
  });
}

function withRecords(
  threats: readonly Threat[],
  mitigations: readonly Mitigation[],
  assumptions: readonly Assumption[] = [],
): Model {
  return {
    ...modelOf(threats),
    mitigations: [...mitigations],
    assumptions: [...assumptions],
  };
}

function isLabel(node: RootContent | undefined, label: string): boolean {
  return (
    node?.type === 'paragraph' &&
    node.children.length === 1 &&
    node.children[0].type === 'strong' &&
    textOf(node.children[0].children) === label
  );
}

function recordItems(
  section: readonly RootContent[],
  label: string,
): readonly ListItem[] {
  const following =
    section[section.findIndex((node) => isLabel(node, label)) + 1];
  return following?.type === 'list' ? following.children : [];
}

function titleLine(item: ListItem): Strong[] {
  const [lead] = item.children;
  return lead.type === 'paragraph'
    ? lead.children.filter((node) => node.type === 'strong')
    : [];
}

const everyRecordLabel = withRecords(
  [threatOf({ number: 1, status: 'mitigated' }), threatOf({ number: 2 })],
  mitigationStatusSchema.options.map((status) =>
    mitigationOf({ id: `mitigation-${status}`, threats: ['threat-2'], status }),
  ),
  assumptionStatusSchema.options.map((status) =>
    assumptionOf({ id: `assumption-${status}`, threats: ['threat-1'], status }),
  ),
);

function badgeTextsIn(
  nodes: readonly RootContent[],
): { readonly badge: RegisterBadge; readonly label: string }[] {
  return nodes.flatMap((node) => {
    if (node.type === 'text') {
      const badge = node.data?.registerBadge;
      return badge === undefined ? [] : [{ badge, label: node.value }];
    }
    return 'children' in node ? badgeTextsIn(node.children) : [];
  });
}

function badgesIn(nodes: readonly RootContent[]): RegisterBadge[] {
  return badgeTextsIn(nodes).map((entry) => entry.badge);
}

function textOf(nodes: readonly RootContent[]): string {
  return nodes
    .map((node) =>
      node.type === 'text'
        ? node.value
        : 'children' in node
          ? textOf(node.children)
          : '',
    )
    .join('');
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

function threatTargetsOf(document: string): string[] {
  return [...document.matchAll(/^<a name="([^"]+)"><\/a>$/gmu)].map(
    (match) => match[1],
  );
}

function overviewLinksOf(
  document: string,
): { readonly number: string; readonly target: string }[] {
  return reader.parse(document).children.flatMap((node) =>
    node.type === 'table'
      ? node.children.slice(1).flatMap((row) => {
          const link = row.children[0]?.children[0];
          return link?.type === 'link'
            ? [{ number: textOf(link.children), target: link.url }]
            : [];
        })
      : [],
  );
}

function sectionsOf(document: string): string[] {
  return document
    .split(/^(?=<a name="threat-\d+"><\/a>\n\n## Threat )/m)
    .slice(1);
}

function threatSectionsIn(tree: Root): RootContent[][] {
  return tree.children.reduce<RootContent[][]>(
    (sections, node) =>
      node.type === 'heading' && node.depth === 2
        ? [...sections, []]
        : sections.length === 0
          ? sections
          : [
              ...sections.slice(0, -1),
              [...sections[sections.length - 1], node],
            ],
    [],
  );
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

  it('links every overview number to its explicit detail target', () => {
    const numbers = model.threats.map((threat) => threat.number);
    numbers.sort((left, right) => left - right);
    const targets = numbers.map((number) => `threat-${String(number)}`);
    expect(threatTargetsOf(renderRegister(model))).toEqual(targets);
    expect(overviewLinksOf(renderRegister(model))).toEqual(
      numbers.map((number) => ({
        number: String(number),
        target: `#threat-${String(number)}`,
      })),
    );
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

  it('says None recorded where the threat carries neither prose nor records', () => {
    const rendered = renderRegister(modelOf([threatOf({ number: 1 })]));
    expect(rendered).toContain('**Description**\n\nNone recorded.');
    expect(rendered).toContain('**Mitigation**\n\nNone recorded.');
    expect(rendered).toContain('**Mitigations**\n\nNone recorded.');
    expect(rendered).toContain('**Assumptions**\n\nNone recorded.');
  });

  it('labels every severity, status, category, record status and flag the model declares', async () => {
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
    const recordLines = [
      ...new Set(
        badgeTextsIn(registerDocument(everyRecordLabel).children)
          .filter(({ badge }) => !['severity', 'status'].includes(badge.kind))
          .map(({ badge, label }) => `${badge.kind} ${badge.value}: ${label}`),
      ),
    ];
    expect(recordLines.length).toBe(
      mitigationStatusSchema.options.length +
        assumptionStatusSchema.options.length +
        threatFlagSchema.options.length,
    );
    await expect(`${listing}\n${recordLines.join('\n')}\n`).toMatchFileSnapshot(
      labelsPath,
    );
  });
});

describe("a threat's records", () => {
  const model = withRecords(
    [threatOf({ number: 1 }), threatOf({ number: 2 })],
    [
      mitigationOf({
        id: 'mitigation-a',
        threats: ['threat-2'],
        prose: 'elsewhere',
      }),
      mitigationOf({
        id: 'mitigation-b',
        threats: ['threat-1'],
        status: 'verified',
        prose: 'second in the model',
      }),
      mitigationOf({ id: 'mitigation-c', threats: [], prose: 'unlinked' }),
      mitigationOf({
        id: 'mitigation-d',
        threats: ['threat-2', 'threat-1'],
        status: 'implemented',
        prose: 'shared',
      }),
    ],
    [
      assumptionOf({ id: 'assumption-a', threats: [], prose: 'unlinked' }),
      assumptionOf({
        id: 'assumption-b',
        threats: ['threat-1'],
        status: 'valid',
        prose: 'held',
      }),
    ],
  );

  it('lists exactly the linked records, with their status badges, in model order', () => {
    const [first] = threatSectionsIn(registerDocument(model));
    const mitigations = recordItems(first, 'Mitigations');
    const assumptions = recordItems(first, 'Assumptions');
    expect(mitigations.map((item) => badgesIn(item.children))).toEqual([
      [{ kind: 'mitigation', value: 'verified' }],
      [{ kind: 'mitigation', value: 'implemented' }],
    ]);
    expect(assumptions.map((item) => badgesIn(item.children))).toEqual([
      [{ kind: 'assumption', value: 'valid' }],
    ]);
    const [written] = threatSectionsIn(reader.parse(renderRegister(model)));
    expect(
      recordItems(written, 'Mitigations').map((item) =>
        textOf(item.children.slice(1)),
      ),
    ).toEqual(['second in the model', 'shared']);
    expect(
      recordItems(written, 'Assumptions').map((item) =>
        textOf(item.children.slice(1)),
      ),
    ).toEqual(['held']);
  });

  it('lists a shared record in each of its threats, and in no other part of the register', () => {
    const tree = registerDocument(model);
    const sections = threatSectionsIn(tree);
    expect(
      sections.map((section) =>
        recordItems(section, 'Mitigations').map((item) =>
          textOf(item.children.slice(1)),
        ),
      ),
    ).toEqual([
      ['second in the model', 'shared'],
      ['elsewhere', 'shared'],
    ]);
    const beforeSections = tree.children.slice(
      0,
      tree.children.findIndex(
        (node) => node.type === 'heading' && node.depth === 2,
      ),
    );
    expect(beforeSections.some((node) => node.type === 'list')).toBe(false);
    expect(textOf(beforeSections)).not.toContain('shared');
    expect(renderRegister(model)).not.toContain('unlinked');
  });

  it('writes a mitigation title before its prose, and no title line where it has none', () => {
    const titledModel = withRecords(
      [threatOf({ number: 1 })],
      [
        mitigationOf({
          id: 'mitigation-titled',
          threats: ['threat-1'],
          title: 'Pinned digests',
          prose: 'titled prose',
        }),
        mitigationOf({
          id: 'mitigation-bare',
          threats: ['threat-1'],
          prose: 'bare prose',
        }),
      ],
    );
    for (const tree of [
      registerDocument(titledModel),
      reader.parse(renderRegister(titledModel)),
    ]) {
      const [section] = threatSectionsIn(tree);
      const [titled, bare] = recordItems(section, 'Mitigations');
      expect(titleLine(titled).map((node) => textOf(node.children))).toEqual([
        'Pinned digests',
      ]);
      expect(textOf(titled.children.slice(1))).toBe('titled prose');
      expect(titleLine(bare)).toEqual([]);
      expect(textOf(bare.children.slice(1))).toBe('bare prose');
    }
  });

  it('parses record prose as markdown, demoting its headings and keeping its lists and HTML', () => {
    const rendered = renderRegister(
      withRecords(
        [threatOf({ number: 1 })],
        [
          mitigationOf({
            id: 'mitigation-a',
            threats: ['threat-1'],
            prose: '# Rollout\n\n* one\n* two\n\n<b>bold</b>',
          }),
        ],
        [
          assumptionOf({
            id: 'assumption-a',
            threats: ['threat-1'],
            prose: '## Premise',
          }),
        ],
      ),
    );
    const [section] = threatSectionsIn(reader.parse(rendered));
    const [mitigation] = recordItems(section, 'Mitigations');
    const [assumption] = recordItems(section, 'Assumptions');
    expect(mitigation.children.map((node) => node.type)).toEqual([
      'paragraph',
      'heading',
      'list',
      'paragraph',
    ]);
    expect(
      [mitigation.children[1], assumption.children[1]].map((node) =>
        node.type === 'heading' ? node.depth : 0,
      ),
    ).toEqual([3, 4]);
    expect(rendered).toContain('<b>bold</b>');
  });
});

describe("a threat's flags", () => {
  const flagsBySection = (model: Model) =>
    threatSectionsIn(registerDocument(model)).map((section) =>
      badgesIn(section).filter((badge) => badge.kind === 'flag'),
    );

  it('carries a badge for each flag the model derives, and none where there is none', () => {
    const model = withRecords(
      [
        threatOf({ number: 1, status: 'mitigated' }),
        threatOf({ number: 2 }),
        threatOf({ number: 3, status: 'mitigated' }),
      ],
      [
        mitigationOf({
          id: 'mitigation-a',
          threats: ['threat-3'],
          status: 'implemented',
        }),
      ],
      [
        assumptionOf({
          id: 'assumption-a',
          threats: ['threat-1', 'threat-3'],
          status: 'invalidated',
        }),
      ],
    );
    expect(flagsBySection(model)).toEqual([
      [
        { kind: 'flag', value: 'mitigated-without-implemented-work' },
        { kind: 'flag', value: 'rests-on-invalidated-assumption' },
      ],
      [],
      [{ kind: 'flag', value: 'rests-on-invalidated-assumption' }],
    ]);
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

  it('keeps a target when its threat title changes', () => {
    const before = renderRegister(
      modelOf([threatOf({ number: 7, title: 'Token replay' })]),
    );
    const after = renderRegister(
      modelOf([threatOf({ number: 7, title: 'Replay of a token' })]),
    );
    expect(threatTargetsOf(after)).toEqual(threatTargetsOf(before));
    expect(overviewLinksOf(after)).toEqual(overviewLinksOf(before));
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

  it('leaves every surviving target unmoved when one threat is removed', () => {
    const existing = [
      threatOf({ number: 1 }),
      threatOf({ number: 2 }),
      threatOf({ number: 3 }),
    ];
    const targetsBefore = threatTargetsOf(renderRegister(modelOf(existing)));
    const targetsAfter = threatTargetsOf(
      renderRegister(modelOf([existing[0], existing[2]])),
    );
    expect(targetsAfter).toEqual([targetsBefore[0], targetsBefore[2]]);
  });
});
