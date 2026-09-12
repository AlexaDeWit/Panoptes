import { parseModel, type Diagram, type Model } from '@saerskriven/model';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export { drawingFace } from './png.js';

const svgSuffix = '.snapshot.svg';

const pngSuffix = '.snapshot.png';

/** The repository root, which every committed fixture and golden is named from. */
export const repositoryRoot = join(import.meta.dirname, '../../..');

/** A committed model under `test-data`, parsed. */
export function modelFile(name: string): Model {
  return Either.getOrThrow(
    parseModel(
      JSON.parse(readFileSync(join(repositoryRoot, 'test-data', name), 'utf8')),
    ),
  );
}

export const ecluseModel = modelFile('ecluse.model.json');

export const everyGlyphModel = modelFile('every-glyph.model.json');

export const saerskrivenModel = modelFile('saerskriven.model.json');

/**
 * One diagram this package commits goldens for: `svg` is the drawing as a
 * document and `png` is that same drawing rasterized, named from it so the
 * pair cannot drift apart.
 */
export type GoldenDocument = {
  readonly name: string;
  readonly model: Model;
  readonly diagram: number;
  readonly svg: string;
  readonly png: string;
};

/**
 * Every diagram the goldens cover. Each suite over them drives off this one
 * list, so a further model or diagram joins all of them by being added here.
 */
export const goldenDocuments: readonly GoldenDocument[] = [
  golden('the Écluse diagram', ecluseModel, 0, 'ecluse'),
  golden('every glyph', everyGlyphModel, 0, 'every-glyph'),
  golden(
    "Saerskriven's read and render diagram",
    saerskrivenModel,
    0,
    'saerskriven-read-and-render',
  ),
  golden(
    "Saerskriven's agent and desktop diagram",
    saerskrivenModel,
    1,
    'saerskriven-agent-and-desktop',
  ),
];

/** The diagram a golden entry names. */
export function diagramOf(entry: GoldenDocument): Diagram {
  return entry.model.diagrams[entry.diagram];
}

/**
 * The faces a rasterization is offered, `leading` first, which is what
 * `drawingFace` on the `png` subpath explains.
 */
export function ledBy<T>(
  faces: readonly T[],
  named: (face: T) => string,
  leading: string,
): readonly T[] {
  return [
    ...faces.filter((face) => named(face) === leading),
    ...faces.filter((face) => named(face) !== leading),
  ];
}

function golden(
  name: string,
  model: Model,
  diagram: number,
  stem: string,
): GoldenDocument {
  return {
    name,
    model,
    diagram,
    svg: `test-data/render/${stem}${svgSuffix}`,
    png: `test-data/render/${stem}${pngSuffix}`,
  };
}
