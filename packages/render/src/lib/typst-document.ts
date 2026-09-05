import type { UnplacedEndpoint } from '@panoptes/canvas';
import type { Model } from '@panoptes/model';
import type { RootContent } from 'mdast';
import { registerDocument } from './register-tree.js';
import { renderSvg } from './svg-document.js';

const bodyFont = 'Liberation Sans';

const monospaceFont = 'Liberation Mono';

const escapable = /["\\]|\p{Cc}/gu;

const softBreaks = /\r?\n/gu;

/**
 * The whole document as Typst source, and what the drawing left out:
 * `typst` is a complete Typst file, and `unplaced` names every flow endpoint
 * no diagram in it could draw, gathered over every diagram, so a caller
 * reports the gap rather than discovering a missing flow in a PDF.
 */
export type TypstDocument = {
  readonly typst: string;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/**
 * A model as one Typst document: every diagram first, one to a landscape
 * page, then the threat register on portrait pages. The diagrams come first
 * because a reader opens a threat model on the picture and reads the register
 * against it.
 *
 * Each diagram is embedded as the bytes of the SVG document `renderSvg`
 * writes, so the PDF and the standalone `.svg` file are the one drawing.
 * Nothing is referenced from outside the source: no file, no font file, no
 * package, no URL, so a compiler needs no filesystem and no network to turn
 * this into a PDF.
 *
 * The register's content is the mdast tree {@link registerDocument} builds,
 * walked into Typst markup, so the register in a PDF and the register in a
 * markdown file say the same thing in the same order. Every node type mdast
 * can carry has a Typst form, YAML frontmatter aside, which the register's
 * parser is not configured to produce. Raw HTML is written as its own text,
 * as the markdown register writes it: dropping it would delete a mitigation
 * an author wrote in HTML with nothing said, and keep the text between the
 * tags, so the document would assert the author wrote what is left.
 *
 * A link is written as its own text with its address beside it in
 * parentheses, and never as a live link. Following a link out of untrusted
 * prose from inside an audit artifact is refused; writing the address means
 * the reader loses nothing by that. An image is written the same way, its
 * alternative text and its address, since nothing is fetched.
 *
 * Typst markup is a language of its own, where `#` calls a function and
 * `*`, `_`, `` ` ``, `<`, `@`, `[`, `]` and `\` all mean something, and
 * threat prose is untrusted text. So no value out of the model is ever
 * written as markup: every one becomes a Typst string literal, where only
 * `"` and `\` have meaning, and a literal shown in markup position is
 * displayed as the text it holds. Every `#` in the output is therefore this
 * function's own.
 *
 * The document names the fonts it expects, {@link bodyFont} and
 * {@link monospaceFont}, and carries none: a compiler is given them, and
 * substitutes where it has neither. That substitution reaches the embedded
 * drawings too, whose stylesheet asks for Helvetica and Arial, so the PDF
 * and a standalone `.svg` file are the one drawing rather than the one
 * rendering of it.
 *
 * The same model gives the same source on every run, and the source carries
 * no date, so a compiler that is itself deterministic writes the same PDF
 * twice.
 */
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
      return shown(node.value);
    case 'image':
      return addressed(shown(node.alt ?? ''), node.alt ?? '', node.url);
    case 'imageReference':
      return shown(node.alt ?? '');
    case 'inlineCode':
      return `#raw(${literal(node.value)})`;
    case 'link':
      return addressed(
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
