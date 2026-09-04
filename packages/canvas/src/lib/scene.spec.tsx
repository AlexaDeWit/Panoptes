import type { Model } from '@panoptes/model';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ecluseModel,
  everyGlyphModel,
  panoptesModel,
} from './canvas.fixtures.js';
import { layoutDiagram } from './layout.js';
import { svgNumber } from './numbers.js';
import { DiagramGlyphs } from './scene.js';
import { canvasStylesheet } from './stylesheet.js';

const margin = 24;

const scenes: readonly {
  readonly name: string;
  readonly model: Model;
  readonly diagram: number;
  readonly golden: string;
  readonly unplaced: number;
}[] = [
  {
    name: 'the Écluse model',
    model: ecluseModel,
    diagram: 0,
    golden: './ecluse-diagram.snapshot.svg',
    unplaced: 0,
  },
  {
    name: 'every glyph',
    model: everyGlyphModel,
    diagram: 0,
    golden: './every-glyph-diagram.snapshot.svg',
    unplaced: 1,
  },
  {
    name: 'the Panoptes read and render diagram',
    model: panoptesModel,
    diagram: 0,
    golden: './panoptes-read-and-render-diagram.snapshot.svg',
    unplaced: 0,
  },
  {
    name: 'the Panoptes agent and desktop diagram',
    model: panoptesModel,
    diagram: 1,
    golden: './panoptes-agent-and-desktop-diagram.snapshot.svg',
    unplaced: 0,
  },
];

const documentOf = (model: Model, diagram: number): string => {
  const layout = layoutDiagram(model.diagrams[diagram], model);
  const box = [
    layout.bounds.x - margin,
    layout.bounds.y - margin,
    layout.bounds.width + margin * 2,
    layout.bounds.height + margin * 2,
  ]
    .map((value) => svgNumber(value))
    .join(' ');
  return renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={box}>
      <style>{canvasStylesheet}</style>
      <DiagramGlyphs layout={layout} />
    </svg>,
  );
};

describe('a diagram drawn from model data alone', () => {
  it.each(scenes)(
    'draws $name the same bytes twice over',
    ({ model, diagram }) => {
      expect(documentOf(model, diagram)).toBe(documentOf(model, diagram));
    },
  );

  it.each(scenes)(
    'draws $name as the committed golden file',
    async ({ model, diagram, golden }) => {
      await expect(documentOf(model, diagram)).toMatchFileSnapshot(golden);
    },
  );

  it.each(scenes)(
    'draws or reports every element of $name',
    ({ model, diagram, unplaced }) => {
      const layout = layoutDiagram(model.diagrams[diagram], model);
      expect(layout.unplaced).toHaveLength(unplaced);
      expect(
        layout.nodes.length + layout.edges.length + layout.unplaced.length,
      ).toBe(model.diagrams[diagram].elements.length);
    },
  );
});
