import {
  renderCanvasStylesheet,
  defaultRenderTheme,
  type RenderTheme,
  DiagramGlyphs,
  layoutDiagram,
  svgNumber,
  xmlSafeText,
  type CanvasBounds,
  type UnplacedEndpoint,
} from '@saerskriven/canvas';
import type { Diagram, Model } from '@saerskriven/model';
import { renderToStaticMarkup } from 'react-dom/server';

const margin = 8;

/** Standalone SVG bytes, dimensions, and undrawn endpoints. */
export type SvgDocument = {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  readonly unplaced: readonly UnplacedEndpoint[];
};

/** Draws a diagram with the resolved theme and the shared canvas primitives. */
export function renderSvg(
  diagram: Diagram,
  model: Model,
  theme: RenderTheme = defaultRenderTheme,
): SvgDocument {
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
      <rect
        x={svgNumber(box.x)}
        y={svgNumber(box.y)}
        width={svgNumber(box.width)}
        height={svgNumber(box.height)}
        fill={theme.colours.background}
      />
      <style>{renderCanvasStylesheet(theme)}</style>
      <DiagramGlyphs layout={layout} />
    </svg>,
  );
  return {
    svg: `${drawn}\n`,
    width: box.width,
    height: box.height,
    unplaced: layout.unplaced,
  };
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
