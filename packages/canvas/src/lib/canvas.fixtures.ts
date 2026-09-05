import type { Model } from '@panoptes/model';
import { parsedFixture } from '@panoptes/model/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const modelFile = (name: string): unknown =>
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../../test-data', name),
      'utf8',
    ),
  );

/**
 * The model that draws every glyph and every badge tone: the six element
 * kinds, a trust boundary in both shapes, an out-of-scope element, a flow
 * with a waypoint, a flow with a free end, a flow the layout refuses, and
 * open threats spread so that one element carries the stacked pair of
 * badges and another carries the neutral badge alone. It lives under
 * test-data because `packages/render` draws it too, and the layer matrix
 * allows no package dependency between the two readers.
 */
export const everyGlyphModel: Model = parsedFixture(
  modelFile('every-glyph.model.json'),
);

/**
 * The Écluse model in the internal form, read from the file both the model
 * and format suites read, so the canvas draws the same corpus they check.
 */
export const ecluseModel: Model = parsedFixture(modelFile('ecluse.model.json'));

/**
 * Panoptes' own threat model in the internal form, written out of
 * `threat-modelling/panoptes.yaml` by the formats suite. Two diagrams, so
 * the canvas draws a model that holds more than one.
 */
export const panoptesModel: Model = parsedFixture(
  modelFile('panoptes.model.json'),
);
