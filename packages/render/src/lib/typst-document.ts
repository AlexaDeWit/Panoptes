import type { UnplacedEndpoint } from '@saerskriven/canvas';
import type { Model } from '@saerskriven/model';
import type { RootContent } from 'mdast';
import { registerDocument } from './register-tree.js';
import { renderSvg } from './svg-document.js';

const bodyFont = 'Liberation Sans';

const monospaceFont = 'Liberation Mono';

const escapable = /["\\]|\p{Cc}/gu;

const softBreaks = /\r?\n/gu;

/** Complete Typst source and the flow endpoints its diagrams did not draw. */
export type TypstDocument = {
  readonly typst: string;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/** Renders every diagram and the shared register as one Typst document. */
export function renderTypst(model: Model): TypstDocument {
  const drawings = model.diagrams.map((diagram) => renderSvg(diagram, model));
  return {
    typst: [
      preamble(model),
      ...model.diagrams.map((diagram, index) =>
        diagramPage(diagram.title, drawings[index].svg),
      ),
      blocksOf(registerDocument(model).children),
    ].join('\n\n'),
    unplaced: drawings.flatMap((drawing) => drawing.unplaced),
  };
}

function preamble(model: Model): string {
  return [
    `#set document(title: ${literal(model.metadata.title)}, date: none)`,
    '#set page(paper: "a4", margin: 2cm, numbering: "1")',
    `#set text(font: ${literal(bodyFont)}, size: 10pt)`,
    `#show raw: set text(font: ${literal(monospaceFont)}, size: 9pt)`,
    '#set table(inset: 5pt)',
    '#show table: set text(size: 8pt)',
  ].join('\n');
}

function diagramPage(title: string, svg: string): string {
  return [
    '#page(flipped: true)[',
    '#grid(rows: (auto, 1fr), row-gutter: 1em,',
    `heading(level: 1)[${shown(title)}],`,
    'align(center + horizon)[',
    `#image(bytes(${literal(svg)}), format: "svg", fit: "contain", width: 100%, height: 100%)`,
    '],',
    ')',
    ']',
  ].join('\n');
}

function blocksOf(nodes: readonly RootContent[]): string {
  return nodes
    .map((node) => typstOf(node))
    .filter((block) => block.length > 0)
    .join('\n\n');
}

function inlineOf(nodes: readonly RootContent[]): string {
  return nodes.map((node) => typstOf(node)).join('');
}

function typstOf(node: RootContent): string {
  switch (node.type) {
    case 'blockquote':
      return `#quote(block: true)[\n${blocksOf(node.children)}\n]`;
    case 'break':
      return '#linebreak()';
    case 'code':
      return `#raw(block: true, ${literal(node.value)})`;
    case 'definition':
      return shown(`[${node.label ?? node.identifier}]: ${node.url}`);
    case 'delete':
      return `#strike[${inlineOf(node.children)}]`;
    case 'emphasis':
      return `#emph[${inlineOf(node.children)}]`;
    case 'footnoteDefinition':
      return blocksOf(node.children);
    case 'footnoteReference':
      return shown(`[${node.label ?? node.identifier}]`);
    case 'heading':
      return `#heading(level: ${String(node.depth)})[${inlineOf(node.children)}]`;
    case 'html':
      return node.data?.registerTarget === true ? '' : shown(node.value);
    case 'image':
      return addressed(shown(node.alt ?? ''), node.alt ?? '', node.url);
    case 'imageReference':
      return shown(node.alt ?? '');
    case 'inlineCode':
      return `#raw(${literal(node.value)})`;
    case 'link':
      return node.data?.registerTarget === true
        ? inlineOf(node.children)
        : addressed(
            inlineOf(node.children),
            plainTextOf(node.children),
            node.url,
          );
    case 'linkReference':
      return inlineOf(node.children);
    case 'list':
      return listOf(node.ordered === true, node.start, node.children);
    case 'listItem':
      return `[${blocksOf(node.children)}]`;
    case 'paragraph':
      return inlineOf(node.children);
    case 'strong':
      return `#strong[${inlineOf(node.children)}]`;
    case 'table':
      return tableOf(node.children);
    case 'tableCell':
      return `[${inlineOf(node.children)}]`;
    case 'tableRow':
      return node.children.map((cell) => typstOf(cell)).join(', ');
    case 'text':
      return shown(node.value.replace(softBreaks, ' '));
    case 'thematicBreak':
      return '#line(length: 100%)';
    case 'yaml':
      return '';
    default:
      return unwritten(node);
  }
}

function unwritten(_node: never): string {
  return '';
}

function addressed(label: string, plain: string, url: string): string {
  return url.length === 0 || plain === url
    ? label
    : `${label}${shown(` (${url})`)}`;
}

function plainTextOf(nodes: readonly RootContent[]): string {
  return nodes
    .map((node) =>
      node.type === 'text' || node.type === 'inlineCode' ? node.value : '',
    )
    .join('');
}

function listOf(
  ordered: boolean,
  start: number | null | undefined,
  items: readonly RootContent[],
): string {
  const call = ordered ? '#enum' : '#list';
  const from =
    ordered && typeof start === 'number' && start !== 1
      ? `start: ${String(start)}, `
      : '';
  return `${call}(${from}${items.map((item) => typstOf(item)).join(', ')})`;
}

function tableOf(rows: readonly RootContent[]): string {
  const [header] = rows;
  const columns =
    header !== undefined && header.type === 'tableRow'
      ? header.children.length
      : 1;
  const cells = rows.map((row) => typstOf(row)).join(',\n');
  return `#table(columns: ${String(columns)},\n${cells},\n)`;
}

function shown(value: string): string {
  return `#${literal(value)}`;
}

function literal(value: string): string {
  return `"${value.replace(escapable, escapeOf)}"`;
}

function escapeOf(character: string): string {
  if (character === '"' || character === '\\') {
    return `\\${character}`;
  }
  if (character === '\n' || character === '\t') {
    return character;
  }
  return `\\u{${character.charCodeAt(0).toString(16)}}`;
}
