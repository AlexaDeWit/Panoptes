/**
 * How long a spec that compiles a PDF is given, against vitest's default of
 * five seconds. The first compile in a process initialises 28 MB of
 * WebAssembly before it typesets anything, and the scenario that checks the
 * byte path spawns the whole CLI twice, so a loaded machine takes longer than
 * the default allows. It is generous rather than measured: the number is here
 * to stop a slow machine reporting a failure, not to describe one.
 */
export const compileTimeout = 60_000;

const pageTree = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/u;

const titleKey = /\/Title\s*/gu;

const asLatin = (pdf: Uint8Array): string =>
  Buffer.from(pdf).toString('latin1');

/**
 * How many pages a PDF holds, read from the `/Count` of its page tree, which
 * is the document's own answer rather than a count of anything drawn.
 */
export function pageCount(pdf: Uint8Array): number {
  const counted = pageTree.exec(asLatin(pdf));
  return counted === null ? 0 : Number(counted[1]);
}

/**
 * Every `/Title` a PDF carries as text: the outline entry of each heading,
 * and the document's own title. They are PDF strings rather than glyphs, so
 * reading them needs no font and no content stream, and what comes back is
 * the text a reader sees in a viewer's bookmark pane. A `/Title` naming
 * something other than a string, as a role map does, is not one of these.
 */
export function outlineTitles(pdf: Uint8Array): readonly string[] {
  const text = asLatin(pdf);
  const titles: string[] = [];
  titleKey.lastIndex = 0;
  for (
    let found = titleKey.exec(text);
    found !== null;
    found = titleKey.exec(text)
  ) {
    const opener = text[found.index + found[0].length];
    if (opener === '(') {
      titles.push(literalFrom(text, found.index + found[0].length));
    }
    if (opener === '<') {
      titles.push(hexFrom(text, found.index + found[0].length));
    }
  }
  return titles;
}

function literalFrom(text: string, open: number): string {
  let depth = 1;
  let index = open + 1;
  let read = '';
  while (depth > 0 && index < text.length) {
    const character = text[index];
    if (character === '\\') {
      read += text[index + 1] ?? '';
      index += 2;
      continue;
    }
    if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
    if (character === '(') {
      depth += 1;
    }
    read += character;
    index += 1;
  }
  return read;
}

function hexFrom(text: string, open: number): string {
  const close = text.indexOf('>', open);
  const digits = text.slice(open + 1, close).replace(/\s+/gu, '');
  const bytes = Buffer.from(digits, 'hex');
  if (bytes.subarray(0, 2).toString('hex') !== 'feff') {
    return bytes.toString('latin1');
  }
  const wide = Buffer.from(bytes.subarray(2));
  wide.swap16();
  return wide.toString('utf16le');
}
