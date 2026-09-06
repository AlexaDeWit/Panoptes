import { layoutDiagram, panelCover } from '@panoptes/canvas';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import {
  clearOfPanel,
  fitViewport,
  nodeInView,
  revealCentre,
  zoomLimits,
  type CanvasExtent,
} from './viewport.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const reader = layout.nodes.find((node) => node.id === readerElement);

const extent = { width: 400, height: 300 };

describe('nodeInView', () => {
  it('reads a node the canvas draws whole as in view', () => {
    expect(reader && nodeInView(reader, { x: 0, y: 0, zoom: 1 }, extent)).toBe(
      true,
    );
  });

  it('reads a node the canvas has panned off its right edge as out of view', () => {
    expect(
      reader && nodeInView(reader, { x: 350, y: 0, zoom: 1 }, extent),
    ).toBe(false);
  });

  it('reads a node the canvas has panned off its top as out of view', () => {
    expect(
      reader && nodeInView(reader, { x: 0, y: -10, zoom: 1 }, extent),
    ).toBe(false);
  });

  it('counts the zoom, a node drawn larger than the canvas being out of view', () => {
    expect(reader && nodeInView(reader, { x: 0, y: 0, zoom: 4 }, extent)).toBe(
      false,
    );
  });
});

describe('clearOfPanel', () => {
  it('takes what the panel covers off the right of the canvas', () => {
    expect(clearOfPanel({ width: 1000, height: 600 })).toEqual({
      width: 1000 - panelCover,
      height: 600,
    });
  });

  it('leaves nothing clear in a canvas narrower than the panel', () => {
    expect(clearOfPanel({ width: 100, height: 600 }).width).toBe(0);
  });

  it('reads a node the panel covers as out of view, where the whole canvas would not', () => {
    const viewport = { x: 700, y: 0, zoom: 1 };
    const whole = { width: 1000, height: 600 };
    expect(reader && nodeInView(reader, viewport, whole)).toBe(true);
    expect(reader && nodeInView(reader, viewport, clearOfPanel(whole))).toBe(
      false,
    );
  });
});

describe('revealCentre', () => {
  it('centres a node in what the panel leaves rather than in the canvas', () => {
    const centred = reader && revealCentre(reader, 1);
    const node = reader && {
      x: reader.position.x + reader.size.width / 2,
      y: reader.position.y + reader.size.height / 2,
    };
    expect(centred?.x).toBe((node?.x ?? 0) + panelCover / 2);
    expect(centred?.y).toBe(node?.y);
  });

  it('counts the zoom, the panel covering a fixed part of the page', () => {
    const closer = reader && revealCentre(reader, 2);
    const centre = reader && reader.position.x + reader.size.width / 2;
    expect(closer?.x).toBe((centre ?? 0) + panelCover / 4);
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
