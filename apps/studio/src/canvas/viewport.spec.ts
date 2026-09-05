import { layoutDiagram } from '@panoptes/canvas';
import { canvasModel, readerElement } from './canvas.fixtures.js';
import { nodeInView } from './viewport.js';

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
