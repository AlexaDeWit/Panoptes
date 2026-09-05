import { elementId } from '@panoptes/model/fixtures';
import { Position, ReactFlowProvider, type EdgeProps } from '@xyflow/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { everyGlyphModel } from './canvas.fixtures.js';
import { handleSides } from './handles.js';
import { layoutDiagram, type CanvasNode } from './layout.js';
import {
  canvasEdgeTypes,
  canvasNodeTypes,
  CanvasEdgeBody,
  CanvasFreeEndBody,
  CanvasNodeBody,
  flowEndNodeId,
  freeEndNodeKind,
  freeEndNodes,
  toReactFlowEdges,
  toReactFlowNodes,
  type CanvasFlowEdge,
  type CanvasFlowNode,
} from './react-flow.js';

const layout = layoutDiagram(everyGlyphModel.diagrams[0], everyGlyphModel);

const nodeNamed = (value: string): CanvasNode => {
  const found = layout.nodes.find((node) => node.id === elementId(value));
  if (found === undefined) {
    throw new Error(`No node ${value} in the layout`);
  }
  return found;
};

const nodeProps = (node: CanvasNode) => ({
  id: node.id,
  data: { node },
  type: node.kind,
  dragging: false,
  zIndex: 0,
  selectable: false,
  deletable: false,
  selected: false,
  draggable: false,
  isConnectable: false,
  positionAbsoluteX: node.position.x,
  positionAbsoluteY: node.position.y,
});

const edgeProps = (
  data: { readonly edge: (typeof layout.edges)[number] } | undefined,
): EdgeProps<CanvasFlowEdge> => ({
  id: 'el-request',
  source: 'el-client',
  target: 'el-api',
  sourceX: 0,
  sourceY: 0,
  targetX: 0,
  targetY: 0,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  data,
});

const bodyMarkup = (node: CanvasNode): string =>
  renderToStaticMarkup(
    <ReactFlowProvider>
      <CanvasNodeBody {...nodeProps(node)} />
    </ReactFlowProvider>,
  );

describe('canvasNodeTypes', () => {
  it('names one node type for every kind the layout produces, and the free-end anchor', () => {
    expect(new Set(Object.keys(canvasNodeTypes))).toEqual(
      new Set<string>([
        ...layout.nodes.map((node) => node.kind),
        freeEndNodeKind,
      ]),
    );
  });
});

describe('canvasEdgeTypes', () => {
  it('names one edge type, for a flow', () => {
    expect(Object.keys(canvasEdgeTypes)).toEqual(['flow']);
  });
});

describe('CanvasNodeBody', () => {
  it('sizes its surface from the model and measures nothing', () => {
    const node = nodeNamed('el-client');
    expect(bodyMarkup(node)).toContain(
      `<svg width="${node.size.width}" height="${node.size.height}"`,
    );
  });

  it('draws the shared glyph and nothing of its own', () => {
    expect(bodyMarkup(nodeNamed('el-client'))).toContain('<rect');
  });

  it('carries a handle at each side, named for that side', () => {
    const markup = bodyMarkup(nodeNamed('el-client'));
    for (const side of handleSides) {
      expect(markup).toContain(`data-handleid="${side}"`);
    }
  });
});

describe('CanvasEdgeBody', () => {
  it('draws the flow from the geometry the layout resolved', () => {
    const markup = renderToStaticMarkup(
      <CanvasEdgeBody {...edgeProps({ edge: layout.edges[0] })} />,
    );
    expect(markup).toContain('d="M 200 100 L 240 100 L 280 120"');
  });

  it('draws nothing where React Flow hands it an edge with no data', () => {
    expect(
      renderToStaticMarkup(<CanvasEdgeBody {...edgeProps(undefined)} />),
    ).toBe('');
  });
});

describe('toReactFlowNodes', () => {
  it('carries the model position and extent on the node itself', () => {
    const node = nodeNamed('el-api');
    const converted = toReactFlowNodes(layout).find(
      (one: CanvasFlowNode) => one.id === node.id,
    );
    expect(converted).toEqual({
      id: node.id,
      type: 'process',
      position: node.position,
      width: node.size.width,
      height: node.size.height,
      data: { node },
    });
  });

  it('carries one React Flow node per laid-out node, flows excluded', () => {
    expect(toReactFlowNodes(layout)).toHaveLength(layout.nodes.length);
  });
});

const looseFlow = layout.edges.find((edge) => edge.sourceElement === undefined);

describe('CanvasFreeEndBody', () => {
  it('draws the one handle an edge end resolves from, and nothing else', () => {
    const markup = renderToStaticMarkup(
      <ReactFlowProvider>
        <CanvasFreeEndBody />
      </ReactFlowProvider>,
    );
    expect(markup).toContain('react-flow__handle');
    expect(markup).not.toContain('<svg');
  });
});

describe('toReactFlowEdges', () => {
  it('carries one edge per drawn flow, ends named by the layout', () => {
    const edges = toReactFlowEdges(layout);
    expect(edges).toHaveLength(layout.edges.length);
    expect(
      edges.find((edge) => edge.id === elementId('el-request')),
    ).toMatchObject({
      type: 'flow',
      source: elementId('el-client'),
      target: elementId('el-api'),
      data: { edge: layout.edges[0] },
    });
  });

  it('ends a flow with a free end on the anchor of that end', () => {
    const converted = toReactFlowEdges(layout).find(
      (edge) => edge.id === looseFlow?.id,
    );
    expect(looseFlow).toBeDefined();
    expect(converted?.source).toBe(
      flowEndNodeId(elementId('el-probe'), 'source'),
    );
  });
});

describe('freeEndNodes', () => {
  it('anchors every free end and nothing else', () => {
    const free = layout.edges.flatMap((edge) => [
      ...(edge.sourceElement === undefined ? ['source'] : []),
      ...(edge.targetElement === undefined ? ['target'] : []),
    ]);
    expect(free.length).toBeGreaterThan(0);
    expect(freeEndNodes(layout)).toHaveLength(free.length);
  });

  it('places an anchor where the layout put the free end, out of reach', () => {
    const anchor = freeEndNodes(layout)[0];
    expect(anchor.position).toEqual(looseFlow?.source);
    expect(anchor.type).toBe(freeEndNodeKind);
    expect(anchor.selectable).toBe(false);
    expect(anchor.draggable).toBe(false);
    expect(anchor.focusable).toBe(false);
  });
});
