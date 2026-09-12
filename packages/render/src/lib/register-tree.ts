import type {
  CustomCategory,
  Element,
  Model,
  Severity,
  Threat,
  ThreatCategory,
  ThreatStatus,
} from '@saerskriven/model';
import type {
  Heading,
  Html,
  Link,
  List,
  Nodes,
  Paragraph,
  Parents,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
  Text,
} from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const prose = unified().use(remarkParse).use(remarkGfm);

const sectionDepth = 2;

const proseDepths = [3, 4, 5, 6, 6, 6] as const;

/** The largest prose depth accepted by both register writers. */
export const deepestProse = 16;

declare module 'mdast' {
  interface HtmlData {
    readonly registerTarget?: true;
  }

  interface LinkData {
    readonly registerTarget?: true;
  }
}

const lineBreaks = /\s*[\r\n]+\s*/gu;

const overviewColumns = [
  'Number',
  'Title',
  'Elements',
  'Category',
  'Severity',
  'Status',
] as const;

const noElements = 'None';

const noProse = 'None recorded.';

const noThreats = 'This model records no threats.';

const severityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  undecided: 'Undecided',
} satisfies Record<Severity, string>;

const statusLabels = {
  open: 'Open',
  mitigated: 'Mitigated',
  transferred: 'Transferred',
  avoided: 'Avoided',
  'accepted-risk': 'Accepted risk',
  eliminated: 'Eliminated',
  'not-applicable': 'Not applicable',
} satisfies Record<ThreatStatus, string>;

type EnumeratedCategory = Exclude<ThreatCategory, CustomCategory>;

type CategoryLabels = {
  [Variant in EnumeratedCategory as Variant['methodology']]: Record<
    Variant['category'],
    string
  >;
};

const categoryLabels = {
  STRIDE: {
    spoofing: 'Spoofing',
    tampering: 'Tampering',
    repudiation: 'Repudiation',
    'information-disclosure': 'Information disclosure',
    'denial-of-service': 'Denial of service',
    'elevation-of-privilege': 'Elevation of privilege',
  },
  LINDDUN: {
    linking: 'Linking',
    identifying: 'Identifying',
    'non-repudiation': 'Non-repudiation',
    detecting: 'Detecting',
    'data-disclosure': 'Data disclosure',
    unawareness: 'Unawareness',
    'non-compliance': 'Non-compliance',
  },
  CIA: {
    confidentiality: 'Confidentiality',
    integrity: 'Integrity',
    availability: 'Availability',
  },
  'CIA-DIE': {
    confidentiality: 'Confidentiality',
    integrity: 'Integrity',
    availability: 'Availability',
    distributed: 'Distributed',
    immutable: 'Immutable',
    ephemeral: 'Ephemeral',
  },
  PLOT4ai: {
    'accountability-and-human-oversight': 'Accountability and human oversight',
    'bias-fairness-and-discrimination': 'Bias, fairness and discrimination',
    cybersecurity: 'Cybersecurity',
    'data-and-data-governance': 'Data and data governance',
    'ethics-and-human-rights': 'Ethics and human rights',
    'privacy-and-data-protection': 'Privacy and data protection',
    'safety-and-environmental-impact': 'Safety and environmental impact',
    'transparency-and-accessibility': 'Transparency and accessibility',
  },
} satisfies CategoryLabels;

/** Builds the shared register tree in threat-number order. */
export function registerDocument(model: Model): Root {
  const threats = [...model.threats];
  threats.sort((left, right) => left.number - right.number);
  const elements = elementsById(model);
  return {
    type: 'root',
    children: [
      heading(1, registerTitle(model)),
      ...(threats.length === 0
        ? [paragraph(noThreats)]
        : [
            overviewTable(threats, elements),
            ...threats.flatMap((threat) => threatSection(threat, elements)),
          ]),
    ],
  };
}

function registerTitle(model: Model): string {
  const title = headingText(model.metadata.title);
  return title.length === 0 ? 'Threat register' : `${title} threat register`;
}

function headingText(value: string): string {
  return value.replace(lineBreaks, ' ').trim();
}

function elementsById(model: Model): Map<string, Element> {
  return new Map(
    model.diagrams
      .flatMap((diagram) => diagram.elements)
      .map((element) => [element.id, element]),
  );
}

function overviewTable(
  threats: readonly Threat[],
  elements: ReadonlyMap<string, Element>,
): Table {
  return {
    type: 'table',
    children: [
      tableRow(overviewColumns),
      ...threats.map((threat) =>
        tableRow([
          threatLink(threat.number),
          threat.title,
          elementNames(threat, elements),
          categoryLabel(threat.category),
          severityLabels[threat.severity],
          statusLabels[threat.status],
        ]),
      ),
    ],
  };
}

function tableRow(cells: readonly (PhrasingContent | string)[]): TableRow {
  return {
    type: 'tableRow',
    children: cells.map((cell): TableCell => ({
      type: 'tableCell',
      children: [typeof cell === 'string' ? text(cell) : cell],
    })),
  };
}

function threatSection(
  threat: Threat,
  elements: ReadonlyMap<string, Element>,
): RootContent[] {
  return [
    threatAnchor(threat.number),
    heading(
      sectionDepth,
      headingText(`Threat ${threat.number}: ${threat.title}`),
    ),
    fieldList(threat, elements),
    ...proseSection('Description', threat.description),
    ...proseSection('Mitigation', threat.mitigation),
  ];
}

function threatAnchor(number: number): Html {
  return {
    type: 'html',
    value: `<a name="${threatTarget(number)}"></a>`,
    data: { registerTarget: true },
  };
}

function threatLink(number: number): Link {
  const target = threatTarget(number);
  return {
    type: 'link',
    url: `#${target}`,
    children: [text(String(number))],
    data: { registerTarget: true },
  };
}

function threatTarget(number: number): string {
  return `threat-${String(number)}`;
}

function fieldList(
  threat: Threat,
  elements: ReadonlyMap<string, Element>,
): List {
  const fields = [
    ['Elements', elementNames(threat, elements)],
    ['Category', categoryLabel(threat.category)],
    ['Severity', severityLabels[threat.severity]],
    ['Status', statusLabels[threat.status]],
  ];
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: fields.map(([label, value]) => ({
      type: 'listItem',
      spread: false,
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'strong', children: [text(label)] },
            text(`: ${value}`),
          ],
        },
      ],
    })),
  };
}

function proseSection(label: string, written: string): RootContent[] {
  return [
    {
      type: 'paragraph',
      children: [{ type: 'strong', children: [text(label)] }],
    },
    ...proseContent(written),
  ];
}

function proseContent(written: string): RootContent[] {
  const parsed = prose.parse(written);
  if (parsed.children.length === 0) {
    return [paragraph(noProse)];
  }
  if (nestingOf(parsed) > deepestProse) {
    return [paragraph(written)];
  }
  visit(parsed, 'heading', (node) => {
    node.depth = proseDepths[node.depth - 1];
  });
  return parsed.children;
}

function nestingOf(tree: Root): number {
  const pending: { readonly node: Nodes; readonly depth: number }[] = [
    { node: tree, depth: 0 },
  ];
  let deepest = 0;
  for (const { node, depth } of pending) {
    deepest = Math.max(deepest, depth);
    if (isParent(node)) {
      for (const child of node.children) {
        pending.push({ node: child, depth: depth + 1 });
      }
    }
  }
  return deepest;
}

function isParent(node: Nodes): node is Parents {
  return Object.hasOwn(node, 'children');
}

function elementNames(
  threat: Threat,
  elements: ReadonlyMap<string, Element>,
): string {
  return threat.elements.length === 0
    ? noElements
    : threat.elements.map((id) => elementName(id, elements)).join(', ');
}

function elementName(
  id: string,
  elements: ReadonlyMap<string, Element>,
): string {
  const element = elements.get(id);
  return element === undefined || element.name.length === 0 ? id : element.name;
}

function categoryLabel(category: ThreatCategory): string {
  return `${categoryName(category)} (${methodologyName(category)})`;
}

function categoryName(category: ThreatCategory): string {
  if (category.methodology === 'STRIDE') {
    return categoryLabels.STRIDE[category.category];
  }
  if (category.methodology === 'LINDDUN') {
    return categoryLabels.LINDDUN[category.category];
  }
  if (category.methodology === 'CIA') {
    return categoryLabels.CIA[category.category];
  }
  if (category.methodology === 'CIA-DIE') {
    return categoryLabels['CIA-DIE'][category.category];
  }
  if (category.methodology === 'PLOT4ai') {
    return categoryLabels.PLOT4ai[category.category];
  }
  return category.category;
}

function methodologyName(category: ThreatCategory): string {
  return category.methodology === 'custom'
    ? category.methodologyName
    : category.methodology;
}

function heading(depth: Heading['depth'], value: string): Heading {
  return { type: 'heading', depth, children: [text(value)] };
}

function paragraph(value: string): Paragraph {
  return { type: 'paragraph', children: [text(value)] };
}

function text(value: string): Text {
  return { type: 'text', value };
}
