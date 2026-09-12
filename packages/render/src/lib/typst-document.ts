import {
  badgeTextColour,
  badgeColour,
  defaultRenderTheme,
  type RenderTheme,
  type UnplacedEndpoint,
} from '@saerskriven/canvas';
import type { Model } from '@saerskriven/model';
import type { RootContent } from 'mdast';
import { registerDocument } from './register-tree.js';
import { renderSvg } from './svg-document.js';

const escapable = /["\\]|\p{Cc}/gu;

const softBreaks = /\r?\n/gu;

/** Complete Typst source and the flow endpoints its diagrams did not draw. */
export type TypstDocument = {
  readonly typst: string;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/** Renders every diagram and the shared register as one Typst document. */
export function renderTypst(
  model: Model,
  theme: RenderTheme = defaultRenderTheme,
): TypstDocument {
  const drawings = model.diagrams.map((diagram) =>
    renderSvg(diagram, model, theme),
  );
  return {
    typst: [
      preamble(model, theme),
      ...model.diagrams.map((diagram, index) =>
        diagramPage(diagram.title, drawings[index].svg),
      ),
      blocksOf(registerDocument(model).children, theme),
    ].join('\n\n'),
    unplaced: drawings.flatMap((drawing) => drawing.unplaced),
  };
}

function preamble(model: Model, theme: RenderTheme): string {
  return [
    `#set document(title: ${literal(model.metadata.title)}, date: none)`,
    `#set page(paper: "a4", margin: 2cm, numbering: "1", fill: rgb(${literal(theme.colours.background)}))`,
    `#set text(font: ${literal(theme.fonts.body)}, size: 10pt, fill: rgb(${literal(theme.colours.text)}))`,
    `#show raw: set text(font: ${literal(theme.fonts.code)}, size: 9pt)`,
    '#set table(inset: 5pt)',
    badgeDefinition(theme),
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

function blocksOf(nodes: readonly RootContent[], theme: RenderTheme): string {
  return nodes
    .map((node) => typstOf(node, theme))
    .filter((block) => block.length > 0)
    .join('\n\n');
}

function inlineOf(nodes: readonly RootContent[], theme: RenderTheme): string {
  return nodes.map((node) => typstOf(node, theme)).join('');
}

function typstOf(node: RootContent, theme: RenderTheme): string {
  switch (node.type) {
    case 'blockquote':
      return `#quote(block: true)[\n${blocksOf(node.children, theme)}\n]`;
    case 'break':
      return '#linebreak()';
    case 'code':
      return `#raw(block: true, ${literal(node.value)})`;
    case 'definition':
      return shown(`[${node.label ?? node.identifier}]: ${node.url}`);
    case 'delete':
      return `#strike[${inlineOf(node.children, theme)}]`;
    case 'emphasis':
      return `#emph[${inlineOf(node.children, theme)}]`;
    case 'footnoteDefinition':
      return blocksOf(node.children, theme);
    case 'footnoteReference':
      return shown(`[${node.label ?? node.identifier}]`);
    case 'heading':
      return `#heading(level: ${String(node.depth)})[${inlineOf(node.children, theme)}]`;
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
        ? inlineOf(node.children, theme)
        : addressed(
            inlineOf(node.children, theme),
            plainTextOf(node.children),
            node.url,
          );
    case 'linkReference':
      return inlineOf(node.children, theme);
    case 'list':
      return listOf(node.ordered === true, node.start, node.children, theme);
    case 'listItem':
      return `[${blocksOf(node.children, theme)}]`;
    case 'paragraph':
      return inlineOf(node.children, theme);
    case 'strong':
      return `#strong[${inlineOf(node.children, theme)}]`;
    case 'table':
      return tableOf(node.children, theme);
    case 'tableCell':
      return `[${inlineOf(node.children, theme)}]`;
    case 'tableRow':
      return node.children.map((cell) => typstOf(cell, theme)).join(', ');
    case 'text':
      return node.data?.registerBadge === undefined
        ? shown(node.value.replace(softBreaks, ' '))
        : `#saer-badge(${literal(node.value)}, rgb(${literal(badgeColour(theme, node.data.registerBadge))}))`;
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
  theme: RenderTheme,
): string {
  const call = ordered ? '#enum' : '#list';
  const from =
    ordered && typeof start === 'number' && start !== 1
      ? `start: ${String(start)}, `
      : '';
  return `${call}(${from}${items.map((item) => typstOf(item, theme)).join(', ')})`;
}

function tableOf(rows: readonly RootContent[], theme: RenderTheme): string {
  const [header] = rows;
  const columns =
    header !== undefined && header.type === 'tableRow'
      ? header.children.length
      : 1;
  const cells = rows.map((row) => typstOf(row, theme)).join(',\n');
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

function badgeDefinition(theme: RenderTheme): string {
  const fill = theme.badges.style === 'outline' ? 'none' : 'tone';
  const lettering =
    theme.badges.text === 'auto' && theme.badges.style === 'outline'
      ? 'tone'
      : `rgb(${literal(badgeTextColour(theme, theme.colours.text))})`;
  return `#let saer-badge(label, tone) = box(inset: (x: 3pt, y: 1pt), radius: 2pt, fill: ${fill}, stroke: (paint: tone, thickness: ${String(theme.badges.borderWidth)}pt), text(fill: ${lettering}, label))`;
}
