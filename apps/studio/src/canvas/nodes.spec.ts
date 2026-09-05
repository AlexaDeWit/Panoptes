import { flowEndNodeId, layoutDiagram } from '@panoptes/canvas';
import {
  canvasModel,
  probeFlow,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import {
  accessibleNames,
  diagramEdges,
  diagramNodes,
  elementIds,
  nodesById,
  withMeasurements,
} from './nodes.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const names = accessibleNames(layout);

describe('accessibleNames', () => {
  it('names an element by what it is called and what kind it is', () => {
    expect(names.get(studioElement)).toBe('Studio, process');
  });

  it('says what an element badge shows, which no glyph says to a reader', () => {
    expect(names.get(readerElement)).toBe(
      'Reader, actor, 1 open threat, highest severity medium',
    );
  });

  it('says an undecided badge is unassessed rather than naming a severity', () => {
    expect(names.get(requestFlow)).toContain('severity not assessed');
  });

  it('names a flow by the elements its ends attach to', () => {
    expect(names.get(requestFlow)).toContain(
      'Opens a model, flow, from Reader to Studio',
    );
  });

  it('names an end that belongs to no element as the free point it is', () => {
    expect(names.get(probeFlow)).toBe(
      'Reads a file, flow, from Studio to a free point',
    );
  });

  it('names every element the layout draws', () => {
    expect(names.size).toBe(layout.nodes.length + layout.edges.length);
  });
});

describe('diagramNodes', () => {
  it('carries an element node per drawn node and an anchor per free end', () => {
    const nodes = diagramNodes(layout, undefined);
    expect(nodes).toHaveLength(layout.nodes.length + 1);
    expect(nodes.at(-1)?.id).toBe(flowEndNodeId(probeFlow, 'target'));
  });

  it('names each element node and marks the one the store has selected', () => {
    const nodes = diagramNodes(layout, readerElement);
    const reader = nodes.find((node) => node.id === readerElement);
    expect(reader?.selected).toBe(true);
    expect(reader?.ariaLabel).toBe(names.get(readerElement));
    expect(nodes.find((node) => node.id === studioElement)?.selected).toBe(
      false,
    );
  });
});

describe('diagramEdges', () => {
  it('carries one named edge per flow and marks the selected one', () => {
    const edges = diagramEdges(layout, requestFlow);
    expect(edges).toHaveLength(2);
    const request = edges.find((edge) => edge.id === requestFlow);
    expect(request?.selected).toBe(true);
    expect(request?.ariaLabel).toBe(names.get(requestFlow));
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
    const measured = diagramNodes(layout, undefined).map((node) => ({
      ...node,
      measured: { width: 120, height: 60 },
    }));

    const carried = withMeasurements(diagramNodes(layout, undefined), measured);

    expect(carried[0].measured).toEqual({ width: 120, height: 60 });
  });

  it('leaves a node nothing was measured for as the model gave it', () => {
    const [first] = withMeasurements(diagramNodes(layout, undefined), []);
    expect(first.measured).toBeUndefined();
  });
});
