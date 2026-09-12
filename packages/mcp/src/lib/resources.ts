import type {
  ListResourcesResult,
  ReadResourceResult,
  Variables,
} from '@modelcontextprotocol/server';
import { quotedForTerminal } from '@saerskriven/formats';
import { defaultLongEdge } from '@saerskriven/render/png';
import { Either } from 'effect';
import { prefaced } from './preface.js';
import { readNamed } from './reading.js';
import { register, renderRegisterResult } from './register.js';
import {
  imageMediaType,
  renderDiagram,
  renderDrawing,
  type RasterizerAssets,
} from './render-diagram.js';
import type { ModelWorkspace } from './workspace.js';

/** The URI of the register of the model the server was started with. */
export const registerUri = 'saer://register';

/**
 * The URI template of one diagram of the model the server was started with,
 * named by its id or its exact title, percent-encoded.
 */
export const diagramUriTemplate = 'saer://diagram/{diagram}';

/** What the register resource tells a client it is. */
export const registerResourceDescription =
  'The threat register of the model this server was started with, as GFM markdown opened by the reading and the data-not-instructions line. It is the text saer_register answers with.';

/** What the diagram resources tell a client they are. */
export const diagramResourceDescription = `One diagram of the model this server was started with, drawn as a PNG ${String(defaultLongEdge)} pixels on its longer edge, followed by the text of saer_render_diagram naming what the drawing left out.`;

/**
 * The name a diagram resource is listed under: its position in the model
 * rather than its title, so a listing carries no text out of the model file
 * outside the percent-encoded URI.
 */
export function diagramResourceName(position: number): string {
  return `Diagram ${String(position)}`;
}

/** The URI of one diagram, from its id. */
export function diagramUri(id: string): string {
  return `saer://diagram/${encodeURIComponent(id)}`;
}

/**
 * The register resource: the register of the default model, or its refusal
 * as text, since a resource read has no error result to put it in.
 */
export function readRegisterResource(
  workspace: ModelWorkspace,
): ReadResourceResult {
  return Either.match(register(workspace, {}), {
    onLeft: (lines) => refusedResource(registerUri, lines),
    onRight: (answer) => ({
      contents: [
        {
          uri: registerUri,
          mimeType: 'text/markdown',
          text: prefaced(renderRegisterResult(answer)),
        },
      ],
    }),
  });
}

/**
 * One diagram resource: the PNG `saer_render_diagram` draws, and the text of
 * that render, or the refusal as text. The name is only ever compared against
 * the ids and titles of the model, so it reaches no path.
 */
export async function readDiagramResource(
  workspace: ModelWorkspace,
  assets: RasterizerAssets,
  uri: URL,
  variables: Variables,
): Promise<ReadResourceResult> {
  const named = decodedName(variables['diagram']);
  if (Either.isLeft(named)) {
    return refusedResource(uri.href, named.left);
  }
  const drawn = await renderDiagram(workspace, assets, {
    diagram: named.right,
  });
  return Either.match(drawn, {
    onLeft: (lines) => refusedResource(uri.href, lines),
    onRight: ({ answer, blocks }) => ({
      contents: [
        ...blocks.flatMap((block) =>
          block.type === 'image'
            ? [{ uri: uri.href, mimeType: imageMediaType, blob: block.data }]
            : [],
        ),
        {
          uri: uri.href,
          mimeType: 'text/plain',
          text: prefaced(renderDrawing(answer)),
        },
      ],
    }),
  });
}

/**
 * One resource per diagram of the default model, and none where there is no
 * default or it cannot be read: the refusal belongs to a read of the URI.
 */
export function diagramResources(
  workspace: ModelWorkspace,
): ListResourcesResult {
  return {
    resources: Either.match(readNamed(workspace, undefined), {
      onLeft: () => [],
      onRight: ({ model }) =>
        model.diagrams.map((diagram, index) => ({
          uri: diagramUri(diagram.id),
          name: diagramResourceName(index + 1),
          mimeType: imageMediaType,
          description: diagramResourceDescription,
        })),
    }),
  };
}

/**
 * The ids of the default model's diagrams that start with what was typed, and
 * none where the model cannot be read.
 */
export function completedDiagrams(
  workspace: ModelWorkspace,
  typed: string,
): string[] {
  return Either.match(readNamed(workspace, undefined), {
    onLeft: () => [],
    onRight: ({ model }) =>
      model.diagrams
        .map((diagram) => diagram.id)
        .filter((id) => id.startsWith(typed)),
  });
}

function decodedName(
  value: string | string[] | undefined,
): Either.Either<string, readonly string[]> {
  if (typeof value !== 'string') {
    return Either.left(['The URI names no single diagram.']);
  }
  return Either.try({
    try: () => decodeURIComponent(value),
    catch: () => [
      `The diagram name ${quotedForTerminal(value)} is not percent-encoded text.`,
    ],
  });
}

function refusedResource(
  uri: string,
  lines: readonly string[],
): ReadResourceResult {
  return {
    contents: [{ uri, mimeType: 'text/plain', text: prefaced(lines) }],
  };
}
