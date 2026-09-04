import type { Model } from '@panoptes/model';
import { renderToStaticMarkup } from 'react-dom/server';
import { ecluseModel, everyGlyphModel } from './canvas.fixtures.js';
import { layoutDiagram } from './layout.js';
import { svgNumber } from './numbers.js';
import { DiagramGlyphs } from './scene.js';
import { canvasStylesheet } from './stylesheet.js';

const margin = 24;

const documentOf = (model: Model): string => {
  const layout = layoutDiagram(model.diagrams[0], model);
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
  it('draws the Écluse model the same bytes twice over', () => {
    expect(documentOf(ecluseModel)).toBe(documentOf(ecluseModel));
  });

  it('draws the Écluse model as the committed golden file', async () => {
    await expect(documentOf(ecluseModel)).toMatchFileSnapshot(
      './ecluse-diagram.svg',
    );
  });

  it('draws every glyph the same bytes twice over', () => {
    expect(documentOf(everyGlyphModel)).toBe(documentOf(everyGlyphModel));
  });

  it('draws every glyph as the committed golden file', async () => {
    await expect(documentOf(everyGlyphModel)).toMatchFileSnapshot(
      './every-glyph-diagram.svg',
    );
  });

  it('places every element of the Écluse diagram', () => {
    const layout = layoutDiagram(ecluseModel.diagrams[0], ecluseModel);
    expect(layout.nodes.length + layout.edges.length).toBe(
      ecluseModel.diagrams[0].elements.length,
    );
    expect(layout.unplaced).toEqual([]);
  });
});
