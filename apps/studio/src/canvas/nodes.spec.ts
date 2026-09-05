import { flowEndNodeId, layoutDiagram } from '@panoptes/canvas';
import {
  boundaryElement,
  canvasModel,
  noteElement,
  probeFlow,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import { accessibleNames } from './names.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  withMeasurements,
} from './nodes.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const names = accessibleNames(layout);

describe('diagramGraph', () => {
  it('carries an element node per drawn node and an anchor per free end', () => {
    const { nodes } = diagramGraph(layout, undefined);
    expect(nodes).toHaveLength(layout.nodes.length + 1);
    expect(nodes.at(-1)?.id).toBe(flowEndNodeId(probeFlow, 'target'));
  });

  it('names each element node and marks the one the store has selected', () => {
    const { nodes } = diagramGraph(layout, readerElement);
    const reader = nodes.find((node) => node.id === readerElement);
    expect(reader?.selected).toBe(true);
    expect(reader?.ariaLabel).toBe(names.get(readerElement));
    expect(nodes.find((node) => node.id === studioElement)?.selected).toBe(
      false,
    );
  });

  it('marks a node a flow can end on connectable, and no other', () => {
    const { nodes } = diagramGraph(layout, undefined);
    const connectable = (id: string): boolean | undefined =>
      nodes.find((node) => node.id === id)?.connectable;

    expect(connectable(readerElement)).toBe(true);
    expect(connectable(studioElement)).toBe(true);
    expect(connectable(boundaryElement)).toBe(false);
    expect(connectable(noteElement)).toBe(false);
  });

  it('carries one named edge per flow and marks the selected one', () => {
    const { edges } = diagramGraph(layout, requestFlow);
    expect(edges).toHaveLength(2);
    const request = edges.find((edge) => edge.id === requestFlow);
    expect(request?.selected).toBe(true);
    expect(request?.ariaLabel).toBe(names.get(requestFlow));
  });

  it('marks a selected flow on the flow alone, no node beside it', () => {
    const { nodes } = diagramGraph(layout, requestFlow);
    expect(nodes.some((node) => node.selected)).toBe(false);
  });
});

describe('elementIds', () => {
  it('holds every element the layout drew and no anchor', () => {
    const ids = elementIds(layout);
    expect(ids.get(requestFlow)).toBe(requestFlow);
    expect(ids.get(readerElement)).toBe(readerElement);
    expect(ids.get(flowEndNodeId(probeFlow, 'target'))).toBeUndefined();
  });
});

describe('nodesById', () => {
  it('holds the drawn nodes, so a reported position has a model one to answer', () => {
    expect(nodesById(layout).get(readerElement)?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(nodesById(layout).get(requestFlow)).toBeUndefined();
  });
});

describe('withMeasurements', () => {
  it('carries the extent React Flow measured onto the nodes the model gives', () => {
    const measured = diagramGraph(layout, undefined).nodes.map((node) => ({
      ...node,
      measured: { width: 120, height: 60 },
    }));

    const carried = withMeasurements(
      diagramGraph(layout, undefined).nodes,
      measured,
    );

    expect(carried[0].measured).toEqual({ width: 120, height: 60 });
  });

  it('leaves a node nothing was measured for as the model gave it', () => {
    const [first] = withMeasurements(diagramGraph(layout, undefined).nodes, []);
    expect(first.measured).toBeUndefined();
  });
});
