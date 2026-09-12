import type { CallToolResult } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { editResultSchema, type EditResult } from './lib/edit.js';
import { inspectResultSchema, type InspectResult } from './lib/inspect.js';

/**
 * The tools a release registers, in the order the server registers them: the
 * reads, then the queries, then the drawing, then the writes. Both the suite
 * over the server object and the one over the packaged executable hold
 * `tools/list` to this, so a tool added without a place in the order fails
 * them rather than appearing unannounced.
 */
export const registeredTools: readonly string[] = [
  'saer_inspect',
  'saer_validate',
  'saer_coverage',
  'saer_register',
  'saer_search_elements',
  'saer_search_threats',
  'saer_get_threat',
  'saer_render_diagram',
  'saer_edit',
  'saer_create',
  'saer_import',
];

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
 * every string a client would show a model as the body of a result, `links`
 * is the free text a resource link carries beside the file it points at, and
 * `unread` names the type of every content block this does not know how to
 * look inside.
 *
 * The last two fields are what keep the first honest. A reader that passed
 * over a block type it did not recognize would report no prose for it and a
 * caller checking the prose would see nothing wrong, so a block type added to
 * the protocol, or reached for the first time by a new tool, comes back named
 * in `unread` rather than going unchecked. A resource link is recognized, and
 * its `name` and `description` are free text a model reads, so they come back
 * in `links` rather than being skipped: they are not the body of a result and
 * do not open with the data-not-instructions line, so a caller checks instead
 * that nothing out of a model file reaches them.
 */
export type ResultProse = {
  readonly prose: readonly string[];
  readonly links: readonly string[];
  readonly unread: readonly string[];
};

/**
 * Every string a tool result would put in front of a model, from each block
 * type this reader knows: a `text` block's own text, the text of a `resource`
 * block's embedded document, which carries none when the resource is a blob,
 * and the `name` and `description` of a `resource_link`, which come back
 * under `links`. An `image` block is recognized and carries no text of its
 * own. Any other block type is named in `unread` rather than skipped.
 */
export function proseOf(result: CallToolResult): ResultProse {
  const prose: string[] = [];
  const links: string[] = [];
  const unread: string[] = [];
  for (const block of result.content) {
    if (block.type === 'text') {
      prose.push(block.text);
    } else if (block.type === 'resource') {
      if ('text' in block.resource) {
        prose.push(block.resource.text);
      }
    } else if (block.type === 'resource_link') {
      links.push(block.name, block.description ?? '');
    } else if (block.type !== 'image') {
      unread.push(block.type);
    }
  }
  return { prose, links, unread };
}

/**
 * A tool result's structured content, read back through the schema the tool
 * advertises, so a spec reasons about typed data and the result is held to
 * the shape a client would validate it against.
 */
export function structuredOf<Schema extends z.ZodType>(
  result: CallToolResult,
  schema: Schema,
): z.infer<Schema> {
  return schema.parse(result.structuredContent);
}

/** What `saer_inspect` reported, read back through the schema it advertises. */
export function inspectionOf(result: CallToolResult): InspectResult {
  return structuredOf(result, inspectResultSchema);
}

/** Every image block of a tool result, as its media type and its bytes. */
export function imagesOf(
  result: CallToolResult,
): readonly { readonly mimeType: string; readonly bytes: Uint8Array }[] {
  return result.content.flatMap((block) =>
    block.type === 'image'
      ? [
          {
            mimeType: block.mimeType,
            bytes: Buffer.from(block.data, 'base64'),
          },
        ]
      : [],
  );
}

/** Every media type a tool result's blocks declare, image blocks included. */
export function mediaTypesOf(result: CallToolResult): readonly string[] {
  return result.content.flatMap((block) =>
    block.type === 'image' || block.type === 'resource_link'
      ? [block.mimeType ?? '']
      : [],
  );
}

/** Every resource link of a tool result, as the file it names. */
export function resourceLinksOf(
  result: CallToolResult,
): readonly { readonly uri: string; readonly name: string }[] {
  return result.content.flatMap((block) =>
    block.type === 'resource_link'
      ? [{ uri: block.uri, name: block.name }]
      : [],
  );
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

/**
 * What `saer_edit` reported, read back through the schema the tool
 * advertises, so a spec reasons about typed data as it does for a reading.
 */
export function editOf(result: CallToolResult): EditResult {
  return structuredOf(result, editResultSchema);
}
