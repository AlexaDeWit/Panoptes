import type {
  ListResourcesResult,
  ReadResourceResult,
  Variables,
} from '@modelcontextprotocol/server';
import { diagramsNamed, type Diagram } from '@saerskriven/model';
import { defaultLongEdge } from '@saerskriven/render/png';
import { Data, Either } from 'effect';
import { prefaced } from './preface.js';
import { readNamed } from './reading.js';
import { register, renderRegisterResult } from './register.js';
import {
  drawnOf,
  imageMediaType,
  rasterized,
  renderDrawing,
  type DrawnDiagram,
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
 * Why a resource read has nothing to answer with: no model to read, no
 * diagram of the name the URI carries, a name that does not percent-decode, or
 * a rasterizer that drew nothing. None of them carries text, so nothing out of
 * a model file reaches the error a client receives.
 */
export type ResourceFailure = Data.TaggedEnum<{
  NoModel: {};
  NoSuchDiagram: {};
  UndecodableName: {};
  RasterizerFailed: {};
}>;

/**
 * Constructor for {@link ResourceFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const ResourceFailure = Data.taggedEnum<ResourceFailure>();

/** The register resource: the register of the default model. */
export function readRegisterResource(
  workspace: ModelWorkspace,
): Either.Either<ReadResourceResult, ResourceFailure> {
  return Either.mapBoth(register(workspace, {}), {
    onLeft: () => ResourceFailure.NoModel(),
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
 * that render. The name is only ever compared against the ids and titles of
 * the model, so it reaches no path.
 */
export async function readDiagramResource(
  workspace: ModelWorkspace,
  assets: RasterizerAssets,
  uri: URL,
  variables: Variables,
): Promise<Either.Either<ReadResourceResult, ResourceFailure>> {
  const chosen = Either.flatMap(decodedName(variables['diagram']), (named) =>
    Either.flatMap(
      Either.mapLeft(readNamed(workspace, undefined), () =>
        ResourceFailure.NoModel(),
      ),
      (reading) =>
        Either.map(
          Either.fromNullable(
            diagramsNamed(reading.model.diagrams, named)[0],
            () => ResourceFailure.NoSuchDiagram(),
          ),
          (diagram) => ({ reading, diagram }),
        ),
    ),
  );
  if (Either.isLeft(chosen)) {
    return Either.left(chosen.left);
  }
  const { reading, diagram } = chosen.right;
  const image = await rasterized(
    diagram,
    reading.model,
    assets,
    defaultLongEdge,
  );
  return Either.mapBoth(image, {
    onLeft: () => ResourceFailure.RasterizerFailed(),
    onRight: (drawing) =>
      diagramContents(uri, drawnOf(reading, diagram, drawing)),
  });
}

/**
 * One resource per diagram of the default model, and none where there is no
 * default or it cannot be read: the refusal belongs to a read of the URI. A
 * diagram whose id is `.` or `..` is left out, since a URL parser removes that
 * segment and the URI would name no diagram.
 */
export function diagramResources(
  workspace: ModelWorkspace,
): ListResourcesResult {
  return {
    resources: Either.match(readNamed(workspace, undefined), {
      onLeft: () => [],
      onRight: ({ model }) =>
        model.diagrams.filter(addressable).map((diagram, index) => ({
          uri: diagramUri(diagram.id),
          name: diagramResourceName(index + 1),
          mimeType: imageMediaType,
          description: diagramResourceDescription,
        })),
    }),
  };
}

/**
 * The ids of the default model's listed diagrams that start with what was
 * typed, and none where the model cannot be read.
 */
export function completedDiagrams(
  workspace: ModelWorkspace,
  typed: string,
): string[] {
  return Either.match(readNamed(workspace, undefined), {
    onLeft: () => [],
    onRight: ({ model }) =>
      model.diagrams
        .filter(addressable)
        .map((diagram) => diagram.id)
        .filter((id) => id.startsWith(typed)),
  });
}

function addressable(diagram: Diagram): boolean {
  return diagram.id !== '.' && diagram.id !== '..';
}

function decodedName(
  value: string | string[] | undefined,
): Either.Either<string, ResourceFailure> {
  return typeof value === 'string'
    ? Either.try({
        try: () => decodeURIComponent(value),
        catch: () => ResourceFailure.UndecodableName(),
      })
    : Either.left(ResourceFailure.NoSuchDiagram());
}

function diagramContents(
  uri: URL,
  { answer, blocks }: DrawnDiagram,
): ReadResourceResult {
  return {
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
  };
}
