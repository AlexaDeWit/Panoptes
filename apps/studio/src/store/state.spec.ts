import {
  boxOfPoints,
  boxesOverlap,
  layoutDiagram,
  nodeTextPlacement,
  textPlacementCorners,
  wrapText,
  wrappedTextStyles,
  type Box,
  type CanvasNode,
  type TextPlacement,
} from '@saerskriven/canvas';
import { emptyModel } from '@saerskriven/model';
import {
  FileLifecycle,
  initialState,
  placeholderModel,
  untitledModel,
} from './state.js';

const layout = layoutDiagram(placeholderModel.diagrams[0], placeholderModel);

const linesOf = (placement: TextPlacement): string[] => {
  const rule = wrappedTextStyles[placement.textStyle];
  return wrapText(placement.text, rule.fontSize, placement.width);
};

const nodeBox = (node: CanvasNode): Box => ({
  minX: node.position.x,
  minY: node.position.y,
  maxX: node.position.x + node.size.width,
  maxY: node.position.y + node.size.height,
});

describe('initialState', () => {
  it('starts clean, with the model as its own saved copy', () => {
    const state = initialState(placeholderModel);
    expect(state.present).toBe(placeholderModel);
    expect(state.saved).toBe(placeholderModel);
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
    expect(state.selection).toEqual([]);
    expect(state.lastFailure).toBeUndefined();
    expect(state.file).toEqual(FileLifecycle.NoFile());
  });
});

describe('placeholderModel', () => {
  it('parses, so the walking skeleton opens on a diagram it can edit', () => {
    expect(placeholderModel).not.toBe(emptyModel);
    expect(placeholderModel.diagrams).toHaveLength(1);
  });

  it('is untitled, so nothing shows a made-up name for a model with no file', () => {
    expect(placeholderModel.metadata.title).toBe(untitledModel);
  });

  it('draws an actor, a store, and the records that run between them', () => {
    expect(layout.nodes.map((node) => [node.kind, node.name])).toEqual([
      ['actor', 'Actor'],
      ['store', 'Store'],
    ]);
    expect(layout.edges.map((edge) => edge.name)).toEqual(['Records']);
  });

  it('sizes every element so its name is drawn on one line', () => {
    const wrapped = [
      ...layout.nodes.map((node) => nodeTextPlacement(node)),
      ...layout.edges.map((edge) => edge.label.name),
    ].map((placement) => [placement.text, linesOf(placement).length]);

    expect(wrapped).toEqual([
      ['Actor', 1],
      ['Store', 1],
      ['Records', 1],
    ]);
  });

  it('leaves the flow name a place clear of both boxes', () => {
    const name = boxOfPoints(textPlacementCorners(layout.edges[0].label.name));
    expect(name).toBeDefined();

    const covered = layout.nodes.filter(
      (node) => name !== undefined && boxesOverlap(name, nodeBox(node)),
    );

    expect(covered.map((node) => node.name)).toEqual([]);
  });
});
