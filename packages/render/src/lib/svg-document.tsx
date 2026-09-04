import {
  canvasStylesheet,
  DiagramGlyphs,
  layoutDiagram,
  svgNumber,
  xmlSafeText,
  type CanvasBounds,
  type UnplacedEndpoint,
} from '@panoptes/canvas';
import type { Diagram, Model } from '@panoptes/model';
import { renderToStaticMarkup } from 'react-dom/server';

const margin = 8;

/**
 * One diagram drawn, and what the layout could not draw: `svg` is a whole
 * SVG document as text, and `unplaced` names every flow endpoint left out of
 * it, so a caller reports the gap rather than discovering a missing flow.
 */
export type SvgDocument = {
  readonly svg: string;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/**
 * One diagram of a model as a standalone SVG document: an `svg` root in the
 * SVG namespace, the diagram's title as the accessible name, the canvas
 * stylesheet in a `style` element, and the diagram's glyphs in painting
 * order, ending in a newline so the bytes are a text file. Nothing is
 * fetched and nothing is referenced from outside the document, so it opens
 * in a browser, embeds in a PDF, and lands in a docs build unchanged.
 *
 * The diagram is one of `model`'s own. Badges count the threats the whole
 * model records, since a threat names elements without naming a diagram, so
 * a diagram drawn against a model that does not hold it draws no badge.
 *
 * The viewBox is the layout's bounds, which already cover every glyph the
 * diagram draws, grown by a small margin on every side. That margin is
 * whitespace and the room a stroke takes on the outside of the line it
 * paints, not an allowance for a label of unknown size.
 *
 * Free text the model carries, the title included, goes through
 * `xmlSafeText`, since XML 1.0 admits neither a C0 control nor an unpaired
 * surrogate and a document holding one is refused whole rather than drawn
 * with a gap.
 *
 * The same model gives the same bytes on every run and every platform: no
 * clock, no randomness, no locale, and no generated id. The one order the
 * output follows is the diagram's own element order, through the layout's
 * painting order, so moving an element in the model moves it in the bytes.
 * That is by design: the layout has no key to sort by that the model does
 * not already carry.
 *
 * A model holding several diagrams is rendered one diagram at a time, and
 * choosing which is the caller's. Nothing here throws: a flow the layout
 * refused comes back in {@link SvgDocument.unplaced} as data.
 */
export function renderSvg(diagram: Diagram, model: Model): SvgDocument {
  const layout = layoutDiagram(diagram, model);
  const box = grown(layout.bounds);
  const drawn = renderToStaticMarkup(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBoxOf(box)}
      width={svgNumber(box.width)}
      height={svgNumber(box.height)}
    >
      <title>{xmlSafeText(diagram.title)}</title>
      <style>{canvasStylesheet}</style>
      <DiagramGlyphs layout={layout} />
    </svg>,
  );
  return { svg: `${drawn}\n`, unplaced: layout.unplaced };
}

function grown(bounds: CanvasBounds): CanvasBounds {
  return {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
  };
}

function viewBoxOf(box: CanvasBounds): string {
  return [box.x, box.y, box.width, box.height]
    .map((value) => svgNumber(value))
    .join(' ');
}
