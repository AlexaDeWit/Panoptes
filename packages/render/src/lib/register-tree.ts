import type {
  CustomCategory,
  Element,
  Model,
  Severity,
  Threat,
  ThreatCategory,
  ThreatStatus,
} from '@panoptes/model';
import type {
  Heading,
  List,
  Nodes,
  Paragraph,
  Parents,
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

const deepestProse = 32;

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

/**
 * The threat register as an mdast tree: the model's title, an overview table
 * of every threat (number, title, elements, category, severity, status), then
 * one section per threat carrying the same fields as a list and the threat's
 * prose. It is what the register is, ahead of any decision about how it is
 * written out, so the markdown and the Typst projections say the same thing.
 *
 * Threats come out in number order whatever order the model holds them in,
 * and the same model always gives the same tree: nothing here reads a clock
 * or a random source.
 *
 * A section heading is `Threat <number>: <title>`, so the anchor a renderer
 * derives from it is a function of that threat alone. Threat numbers are
 * issued once and never reissued, so adding, removing, or reordering threats
 * moves no other threat's anchor.
 *
 * Line breaks are collapsed to single spaces in heading text alone. An ATX
 * heading holds one line, and a serializer handed a heading of two writes
 * something else instead: a title ending in a newline loses its heading
 * altogether, and a title carrying a line that reads like another threat's
 * heading would take that threat's anchor. The table and the field list carry
 * the title as written.
 *
 * A threat's description and mitigation are user-authored markdown. Each is
 * parsed and spliced into its section as nodes, and a heading inside prose is
 * demoted below the section heading so it cannot break the register's
 * structure. Raw HTML in prose is parsed as an `html` node and passed on as
 * written: what to do about it belongs to whatever writes the tree out.
 * Prose nested deeper than 32 levels becomes one paragraph of the author's
 * own bytes instead, because every writer of this tree recurses per level and
 * a deep enough tree would overflow the stack.
 */
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
          String(threat.number),
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

function tableRow(cells: readonly string[]): TableRow {
  return {
    type: 'tableRow',
    children: cells.map((cell): TableCell => ({
      type: 'tableCell',
      children: [text(cell)],
    })),
  };
}

function threatSection(
  threat: Threat,
  elements: ReadonlyMap<string, Element>,
): RootContent[] {
  return [
    heading(
      sectionDepth,
      headingText(`Threat ${threat.number}: ${threat.title}`),
    ),
    fieldList(threat, elements),
    ...proseSection('Description', threat.description),
    ...proseSection('Mitigation', threat.mitigation),
  ];
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
