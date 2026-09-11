import { panelCover } from '@saerskriven/canvas';
import {
  clearOfPanel,
  fitViewport,
  zoomLimits,
  type CanvasExtent,
} from './viewport.js';

describe('clearOfPanel', () => {
  it('takes what the panel covers off the right of the canvas', () => {
    expect(clearOfPanel({ width: 1000, height: 600 }, panelCover)).toEqual({
      width: 1000 - panelCover,
      height: 600,
    });
  });

  it('leaves nothing clear in a canvas narrower than the panel', () => {
    expect(clearOfPanel({ width: 100, height: 600 }, panelCover).width).toBe(0);
  });
});

const diagram = { x: 100, y: 50, width: 800, height: 400 };

const placed = (canvas: CanvasExtent) => {
  const view = fitViewport(diagram, canvas) ?? { x: 0, y: 0, zoom: 0 };
  return {
    zoom: view.zoom,
    left: diagram.x * view.zoom + view.x,
    top: diagram.y * view.zoom + view.y,
    right: (diagram.x + diagram.width) * view.zoom + view.x,
    bottom: (diagram.y + diagram.height) * view.zoom + view.y,
  };
};

const canvas = { width: 1000, height: 600 };

describe('fitViewport', () => {
  it('centres the diagram and leaves 64 pixels clear on the tighter axis', () => {
    const drawn = placed(canvas);

    expect(drawn.left).toBeCloseTo(canvas.width - drawn.right);
    expect(drawn.top).toBeCloseTo(canvas.height - drawn.bottom);
    expect(Math.min(drawn.left, drawn.top)).toBeCloseTo(64);
  });

  it('draws a diagram far smaller than the canvas no larger than the zoom limit', () => {
    const view = fitViewport({ x: 0, y: 0, width: 10, height: 10 }, canvas);

    expect(view?.zoom).toBe(zoomLimits.maximum);
  });

  it('draws a diagram far larger than the canvas no smaller than the zoom limit', () => {
    const view = fitViewport(
      { x: 0, y: 0, width: 100_000, height: 100_000 },
      canvas,
    );

    expect(view?.zoom).toBe(zoomLimits.minimum);
  });

  it('fits nothing where the diagram lays down no ink', () => {
    expect(
      fitViewport({ x: 0, y: 0, width: 0, height: 0 }, canvas),
    ).toBeUndefined();
  });

  it('fits nothing where the padding would take the whole canvas', () => {
    expect(fitViewport(diagram, { width: 100, height: 100 })).toBeUndefined();
  });
});
