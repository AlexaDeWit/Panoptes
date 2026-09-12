import type { ContentBlock } from '@modelcontextprotocol/server';
import { escapedForTerminal, quotedForTerminal } from '@saerskriven/formats';
import {
  acceptedTextSchema,
  diagramIdSchema,
  diagramsNamed,
  elementIdSchema,
  type Diagram,
  type Model,
} from '@saerskriven/model';
import { renderUnplacedWarning } from '@saerskriven/render';
import {
  defaultLongEdge,
  renderPng,
  ResvgFailure,
  type PngImage,
} from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Either } from 'effect';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { fileArgumentSchema } from './inspect.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import type { WithBlocks } from './tool-result.js';
import { createdBytes, renderWriteFailure, type WriteTarget } from './write.js';
import {
  confined,
  extensionOf,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
} from './workspace.js';

/** The media type of every image this server puts in a result. */
export const imageMediaType = 'image/png';

/**
 * The extension a file of those bytes has to carry. A render writes PNG
 * bytes, and a path under another extension would leave a file that a later
 * reader, this server's own codecs among them, takes for something it is
 * not.
 */
export const imageExtension = '.png';

/**
 * Where a render gets the rasterizer module and the faces text is set in.
 * The bytes are the host process's to find, since this package reads no file
 * and a browser and an executable carry them differently, and the faces have
 * to lead with the one the drawings are lettered in, which
 * `@saerskriven/render/png` names as `drawingFace`.
 */
export type RasterizerAssets = () => Either.Either<ResvgAssets, string>;

/** What `saer_render_diagram` takes. */
export const renderDiagramArgumentsSchema = fileArgumentSchema.extend({
  diagram: z
    .string()
    .optional()
    .describe(
      'Which diagram to draw, named by its id or its exact title. A model holding one diagram does not have to name it; a model holding several is refused until this names one.',
    ),
  width: z
    .int()
    .min(1)
    .max(defaultLongEdge)
    .optional()
    .describe(
      `The pixel length of the longer edge of the image, whichever edge that is. It defaults to ${String(defaultLongEdge)}, which is what a host downscales an image block to, and it cannot be asked for larger than that.`,
    ),
  out: z
    .string()
    .optional()
    .describe(
      `Where to also write the PNG, as a path relative to the server root. The path has to end in ${imageExtension}, in any case, since that is what the bytes are, and a path already holding a file is refused rather than replaced. Left out, nothing is written and the image reaches you in the result alone.`,
    ),
});

/** What `saer_render_diagram` takes. */
export type RenderDiagramArguments = z.infer<
  typeof renderDiagramArgumentsSchema
>;

const unplacedSchema = z.object({
  flow: elementIdSchema,
  side: z.enum(['source', 'target']),
  element: elementIdSchema,
});

const writtenImageSchema = z.object({
  file: z.string(),
  uri: z.string(),
  revision: z.string(),
});

/**
 * What `saer_render_diagram` answers with. The bytes of the picture are in
 * the result's image block rather than here: a base64 image in the structured
 * content as well would double what the call costs a caller.
 */
export const renderDiagramResultSchema = readingSchema.extend({
  diagram: z.object({ id: diagramIdSchema, title: acceptedTextSchema }),
  image: z.object({
    mimeType: z.literal(imageMediaType),
    width: z.int().positive(),
    height: z.int().positive(),
    bytes: z.int().positive(),
  }),
  unplaced: z.array(unplacedSchema),
  written: writtenImageSchema.optional(),
});

/** What `saer_render_diagram` answers with. */
export type RenderDiagramResult = z.infer<typeof renderDiagramResultSchema>;

/**
 * What a resource link says about the picture it points at. It is built out
 * of the image's own numbers and carries no text out of the model file, so a
 * suite comparing a link against this catches a tool that starts quoting one.
 */
export function imageLinkDescription(width: number, height: number): string {
  return `One diagram of a Saerskriven threat model, drawn as a PNG ${String(width)} by ${String(height)} pixels.`;
}

/** What a render produced: the answer a client validates, and the blocks it carries. */
export type DrawnDiagram = WithBlocks<RenderDiagramResult>;

/** What `saer_render_diagram` tells a client it is for. */
export const renderDiagramDescription = [
  'Draw one diagram of a Saerskriven threat model as a picture and return it as a PNG image block, so you can see the shape of the system rather than read a listing of its parts.',
  'Call this when the geometry matters: which elements a trust boundary encloses, where a flow runs, what the diagram looks like to the people who drew it. Do not call it to enumerate elements or threats, which saer_search_elements and saer_search_threats answer in a fraction of the context a picture costs.',
  'Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model. `diagram` names which diagram to draw by id or exact title, and a model of one diagram does not need it. `width` is the pixel length of the longer edge. `out` also writes the PNG to a path under the root, which comes back as a resource link.',
  `The image is always PNG, never SVG, and never larger than ${String(defaultLongEdge)} pixels on its longer edge. A flow whose endpoint names an element the canvas draws as no box is left out of the drawing, and the text of the result names every such endpoint, so a picture is not the whole diagram where that list is not empty.`,
  'Called without `out` this tool writes nothing. Called with it, it writes that one PNG and never a model, and it refuses a path that is already taken rather than replacing what is there.',
].join(' ');

/**
 * One diagram as a picture, or the lines saying why there is none: no model
 * to read, no diagram of that name, a rasterizer this install cannot start,
 * or a path for `out` that is outside the root or already taken.
 */
export async function renderDiagram(
  workspace: ModelWorkspace,
  assets: RasterizerAssets,
  args: RenderDiagramArguments,
): Promise<Either.Either<DrawnDiagram, readonly string[]>> {
  const prepared = Either.flatMap(readNamed(workspace, args.file), (reading) =>
    Either.map(chosenDiagram(reading.model, args.diagram), (diagram) => ({
      reading,
      diagram,
    })),
  );
  return Either.isLeft(prepared)
    ? Either.left(prepared.left)
    : drawn(workspace, assets, args, prepared.right);
}

/** The render as the lines its text result carries. */
export function renderDrawing(result: RenderDiagramResult): readonly string[] {
  return [
    ...renderReading(result),
    `diagram: ${result.diagram.id} (${escapedForTerminal(result.diagram.title)})`,
    `image: ${result.image.mimeType}, ${String(result.image.width)} by ${String(result.image.height)} pixels, ${String(result.image.bytes)} bytes`,
    ...(result.written === undefined
      ? []
      : [`written: ${escapedForTerminal(result.written.file)}`]),
    ...unplacedLines(result.unplaced),
  ];
}

function unplacedLines(
  unplaced: readonly z.infer<typeof unplacedSchema>[],
): readonly string[] {
  const warning = renderUnplacedWarning(unplaced);
  return warning === '' ? [] : warning.trimEnd().split('\n');
}

type ChosenDiagram = {
  readonly reading: ModelReading;
  readonly diagram: Diagram;
};

async function drawn(
  workspace: ModelWorkspace,
  assets: RasterizerAssets,
  args: RenderDiagramArguments,
  chosen: ChosenDiagram,
): Promise<Either.Either<DrawnDiagram, readonly string[]>> {
  const target = writeTarget(workspace, args.out);
  if (Either.isLeft(target)) {
    return Either.left(target.left);
  }
  const found = assets();
  if (Either.isLeft(found)) {
    return Either.left([
      `This install cannot draw a PNG: ${escapedForTerminal(found.left)}.`,
    ]);
  }
  const image = await renderPng(chosen.diagram, chosen.reading.model, {
    assets: found.right,
    longEdge: args.width ?? defaultLongEdge,
  });
  return Either.flatMap(Either.mapLeft(image, refused), (drawing) =>
    answered(chosen, drawing, target.right),
  );
}

function writeTarget(
  workspace: ModelWorkspace,
  out: string | undefined,
): Either.Either<WriteTarget | undefined, readonly string[]> {
  if (out === undefined) {
    return Either.right(undefined);
  }
  return Either.flatMap(
    Either.mapLeft(confined(workspace, out), renderWorkspaceFailure),
    (path) =>
      Either.map(endsInPng(out), () => ({
        file: withinRoot(workspace, path),
        path,
      })),
  );
}

function endsInPng(out: string): Either.Either<void, readonly string[]> {
  return extensionOf(out) === imageExtension
    ? Either.right(undefined)
    : Either.left([
        `The path ${quotedForTerminal(out)} does not end in ${imageExtension}, and this tool writes the bytes of a PNG.`,
        `Name it with a ${imageExtension} extension, so a later reader of that path finds what the name says it holds.`,
      ]);
}

function answered(
  chosen: ChosenDiagram,
  drawing: PngImage,
  target: WriteTarget | undefined,
): Either.Either<DrawnDiagram, readonly string[]> {
  return Either.map(saved(target, drawing.png), (written) => {
    const answer = resultOf(chosen, drawing, written);
    return { answer, blocks: blocksOf(answer, drawing.png) };
  });
}

function saved(
  target: WriteTarget | undefined,
  png: Uint8Array,
): Either.Either<
  z.infer<typeof writtenImageSchema> | undefined,
  readonly string[]
> {
  return target === undefined
    ? Either.right(undefined)
    : Either.mapBoth(createdBytes(target, png), {
        onLeft: renderWriteFailure,
        onRight: (revision) => ({
          file: target.file,
          uri: pathToFileURL(target.path).href,
          revision,
        }),
      });
}

function resultOf(
  chosen: ChosenDiagram,
  drawing: PngImage,
  written: z.infer<typeof writtenImageSchema> | undefined,
): RenderDiagramResult {
  return {
    ...reportedReading(chosen.reading),
    diagram: { id: chosen.diagram.id, title: chosen.diagram.title },
    image: {
      mimeType: imageMediaType,
      width: drawing.width,
      height: drawing.height,
      bytes: drawing.png.length,
    },
    unplaced: drawing.unplaced.map((endpoint) => ({
      flow: endpoint.flow,
      side: endpoint.side,
      element: endpoint.element,
    })),
    ...(written === undefined ? {} : { written }),
  };
}

function blocksOf(
  answer: RenderDiagramResult,
  png: Uint8Array,
): readonly ContentBlock[] {
  return [
    {
      type: 'image',
      data: Buffer.from(png).toString('base64'),
      mimeType: answer.image.mimeType,
    },
    ...(answer.written === undefined
      ? []
      : [
          {
            type: 'resource_link' as const,
            uri: answer.written.uri,
            name: answer.written.file,
            mimeType: answer.image.mimeType,
            description: imageLinkDescription(
              answer.image.width,
              answer.image.height,
            ),
          },
        ]),
  ];
}

function refused(failure: ResvgFailure): readonly string[] {
  return ResvgFailure.$match(failure, {
    Refused: ({ sentence }) => [
      `The diagram was not drawn: ${escapedForTerminal(sentence)}.`,
    ],
    Unusable: ({ sentence }) => [
      `This install cannot draw a PNG: ${escapedForTerminal(sentence)}.`,
    ],
  });
}

function chosenDiagram(
  model: Model,
  named: string | undefined,
): Either.Either<Diagram, readonly string[]> {
  return named === undefined
    ? theOnlyDiagram(model)
    : theNamedDiagram(model, named);
}

function theOnlyDiagram(
  model: Model,
): Either.Either<Diagram, readonly string[]> {
  const [only] = model.diagrams;
  if (only !== undefined && model.diagrams.length === 1) {
    return Either.right(only);
  }
  return Either.left(
    model.diagrams.length === 0
      ? ['The model holds no diagram, so there is nothing to draw.']
      : [
          'The model holds several diagrams, so `diagram` has to name the one to draw:',
          ...diagramList(model),
        ],
  );
}

function theNamedDiagram(
  model: Model,
  named: string,
): Either.Either<Diagram, readonly string[]> {
  const [found] = diagramsNamed(model.diagrams, named);
  return found === undefined
    ? Either.left([
        `The model holds no diagram named ${quotedForTerminal(named)}.`,
        ...diagramList(model),
      ])
    : Either.right(found);
}

function diagramList(model: Model): readonly string[] {
  return model.diagrams.map(
    (diagram) => `  ${diagram.id}: ${escapedForTerminal(diagram.title)}`,
  );
}
