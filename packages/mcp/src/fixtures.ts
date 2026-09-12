import type { CallToolResult } from '@modelcontextprotocol/server';
import { inspectResultSchema, type InspectResult } from './lib/inspect.js';

/**
 * Which era a client opens a connection in. The SDK's client defaults to
 * `legacy`, so a suite that means to exercise the 2026-07-28 revision asks
 * for `modern` and gets the `server/discover` probe.
 */
export type Era = 'legacy' | 'modern';

/** Both eras a release has to serve, for a suite that runs over each. */
export const eras: readonly Era[] = ['legacy', 'modern'];

/** The text of a tool result's first text block, and nothing where it has none. */
export function textOf(result: CallToolResult): string {
  const block = result.content.find((entry) => entry.type === 'text');
  return block?.type === 'text' ? block.text : '';
}

/**
 * What a tool result says, and what this reader could not read: `prose` is
 * every string a client would show a model, in the order the result carries
 * them, and `unread` names the type of every content block this does not
 * know how to look inside.
 *
 * The second field is what keeps the first honest. A reader that passed over
 * a block type it did not recognize would report no prose for it and a
 * caller checking the prose would see nothing wrong, so a block type added
 * to the protocol, or reached for the first time by a new tool, comes back
 * named here and fails the spec that reads it rather than going unchecked.
 */
export type ResultProse = {
  readonly prose: readonly string[];
  readonly unread: readonly string[];
};

/**
 * Every string a tool result would put in front of a model, from each block
 * type this reader knows: a `text` block's own text, and the text of a
 * `resource` block's embedded document, which carries none when the resource
 * is a blob. Any other block type is named in `unread` rather than skipped.
 */
export function proseOf(result: CallToolResult): ResultProse {
  const prose: string[] = [];
  const unread: string[] = [];
  for (const block of result.content) {
    if (block.type === 'text') {
      prose.push(block.text);
    } else if (block.type === 'resource') {
      if ('text' in block.resource) {
        prose.push(block.resource.text);
      }
    } else {
      unread.push(block.type);
    }
  }
  return { prose, unread };
}

/**
 * A tool result's structured content, read back through the schema the tool
 * advertises, so a spec reasons about typed data and the result is held to
 * the shape a client would validate it against.
 */
export function inspectionOf(result: CallToolResult): InspectResult {
  return inspectResultSchema.parse(result.structuredContent);
}

/** The reading inside an inspection, where the call was to read a file. */
export function readingOf(
  result: CallToolResult,
): Extract<InspectResult['result'], { kind: 'inspected' }> {
  const inspection = inspectionOf(result);
  if (inspection.result.kind !== 'inspected') {
    throw new Error('the call listed candidates where it was to read a file');
  }
  return inspection.result;
}
