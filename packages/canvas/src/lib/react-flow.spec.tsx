import { elementId } from '@saerskriven/model/fixtures';
import { Position, ReactFlowProvider, type EdgeProps } from '@xyflow/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { everyGlyphModel } from './canvas.fixtures.js';
import { handleSides } from './handles.js';
import { canvasClassNames } from './stylesheet.js';
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
  layoutAtReactFlowNodes,
  toReactFlowEdges,
  toReactFlowNodes,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasEdgeData,
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
  data: CanvasEdgeData | undefined,
  selected = false,
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
  selected,
  data,
});

const bodyMarkup = (
  node: CanvasNode,
  selected = false,
  isConnectable = false,
  controlsVisible = true,
  size?: { readonly width: number; readonly height: number },
  resizing = false,
  textVisible = true,
): string =>
  renderToStaticMarkup(
    <ReactFlowProvider>
      <CanvasNodeBody
        {...nodeProps(node)}
        selected={selected}
        isConnectable={isConnectable}
        controlsVisible={controlsVisible}
        width={size?.width}
        height={size?.height}
        resizing={resizing}
        textVisible={textVisible}
      />
    </ReactFlowProvider>,
  );

const edgeMarkup = (
  data: CanvasEdgeData | undefined,
  nodes: CanvasFlowNode[] = [],
  selected = false,
  textVisible = true,
): string =>
  renderToStaticMarkup(
    <ReactFlowProvider initialNodes={nodes}>
      <CanvasEdgeBody
        {...edgeProps(data, selected)}
        textVisible={textVisible}
      />
    </ReactFlowProvider>,
  );

const nodesWith = (moved: string, by: number): CanvasFlowNode[] =>
  toReactFlowNodes(layout).map((node) =>
    node.id === elementId(moved)
      ? { ...node, position: { x: node.position.x, y: node.position.y + by } }
      : node,
  );

const curveNode = layout.nodes.find((node) => node.kind === 'boundary-curve');

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
      `<svg width="${node.size.width}" height="${node.size.height}" style="display:block"`,
    );
  });

  it('draws the shared glyph and nothing of its own', () => {
    expect(bodyMarkup(nodeNamed('el-client'))).toContain('<rect');
  });

  it('draws the glyph at the transient extent React Flow reports', () => {
    const markup = bodyMarkup(
      nodeNamed('el-client'),
      false,
      false,
      true,
      { width: 200, height: 90 },
      true,
    );
    expect(markup).toContain('<svg width="200" height="90"');
    expect(markup).toContain(
      '<rect class="pn-shape pn-actor" width="200" height="90"',
    );
  });

  it('carries a handle at each side, named for that side', () => {
    const markup = bodyMarkup(nodeNamed('el-client'));
    for (const side of handleSides) {
      expect(markup).toContain(`data-handleid="${side}"`);
    }
  });

  it('lets React Flow connect only through handles of a connectable node', () => {
    expect(bodyMarkup(nodeNamed('el-client'), false, true)).toMatch(
      /class="[^"]*\bconnectable\b/u,
    );
    expect(bodyMarkup(nodeNamed('el-zone'))).not.toMatch(
      /class="[^"]*\bconnectable\b/u,
    );
  });

  it('offers four side controls and four corner controls on a selected resizable element', () => {
    const node = nodeNamed('el-client');
    const markup = bodyMarkup(node, true);
    expect(markup.match(/react-flow__resize-control/gu)).toHaveLength(8);
    for (const position of ['top', 'right', 'bottom', 'left']) {
      expect(markup).toContain(`Resize ${node.name} from ${position}`);
    }
    expect(markup).toContain('aria-keyshortcuts="ArrowUp ArrowDown"');
    expect(markup.match(/class="[^"]*\bline\b/gu)).toHaveLength(4);
    expect(markup.match(/class="[^"]*\bhandle\b/gu)).toHaveLength(4);
  });

  it('hides connection and resize controls while a name field is open', () => {
    const markup = bodyMarkup(nodeNamed('el-client'), true, true, false);
    expect(markup.match(/visibility:hidden/gu)).toHaveLength(12);
  });

  it('draws no text while a text field is open over it', () => {
    const node = nodeNamed('el-client');
    expect(bodyMarkup(node)).toContain(canvasClassNames.label);
    expect(
      bodyMarkup(node, true, true, false, undefined, false, false),
    ).not.toContain(canvasClassNames.label);
  });

  it('offers none while the element is not selected', () => {
    expect(bodyMarkup(nodeNamed('el-client'))).not.toContain(
      'react-flow__resize-control',
    );
  });

  it('offers none on a boundary curve, which the model gives no extent', () => {
    expect(curveNode).toBeDefined();
    expect(curveNode && bodyMarkup(curveNode, true)).not.toContain(
      'react-flow__resize-control',
    );
  });

  it('gives each boundary outline a wider invisible pointer target', () => {
    for (const node of [nodeNamed('el-zone'), curveNode]) {
      expect(node).toBeDefined();
      const markup = node === undefined ? '' : bodyMarkup(node);
      expect(markup).toContain(
        'class="pn-boundary-hit-target" fill="none" ' +
          'pointer-events="stroke" stroke="transparent" stroke-width="20"',
      );
    }
  });
});

describe('CanvasEdgeBody', () => {
  const settled = 'd="M 200 100 L 240 100 L 280 120"';

  it('draws the flow from the geometry the layout resolved', () => {
    const data = toReactFlowEdges(layout)[0].data;
    expect(edgeMarkup(data, nodesWith('el-client', 0))).toContain(settled);
  });

  it('draws no name while a name field is open over it', () => {
    const data = toReactFlowEdges(layout)[0].data;
    expect(edgeMarkup(data, nodesWith('el-client', 0))).toContain(
      canvasClassNames.flowLabel,
    );
    expect(
      edgeMarkup(data, nodesWith('el-client', 0), false, false),
    ).not.toContain(canvasClassNames.flowLabel);
  });

  it("adds React Flow's wider interaction path around the flow", () => {
    const markup = edgeMarkup({ edge: layout.edges[0] });
    expect(markup).toContain('react-flow__edge-interaction');
    expect(markup).toContain('stroke-width="20"');
  });

  it('anchors an end on the node React Flow has, not the model position', () => {
    const data = toReactFlowEdges(layout)[0].data;
    expect(edgeMarkup(data, nodesWith('el-client', 200))).toContain(
      'd="M 120 260 L 240 100 L 280 120"',
    );
  });

  it('falls back on the settled geometry where React Flow has no node', () => {
    expect(edgeMarkup({ edge: layout.edges[0] })).toContain(settled);
  });

  it('draws changed geometry from the transient layout', () => {
    const moved = {
      ...layout.edges[0],
      source: { x: 120, y: 260 },
    };
    expect(edgeMarkup({ edge: moved })).toContain(
      'd="M 120 260 L 240 100 L 280 120"',
    );
  });

  it('moves a selected flow with an unrelated dragged node', () => {
    const nodes = toReactFlowNodes(layout).map((node) =>
      node.id === elementId('el-note')
        ? {
            ...node,
            position: { x: node.position.x + 40, y: node.position.y + 25 },
            selected: true,
          }
        : node,
    );
    const data = toReactFlowEdges(layout)[0].data;

    expect(edgeMarkup(data, nodes, true)).toContain(
      'd="M 200 100 L 280 125 L 280 120"',
    );
  });

  it('keeps a selected flow still before its group moves', () => {
    const nodes = toReactFlowNodes(layout).map((node) => ({
      ...node,
      selected: node.id === elementId('el-note'),
    }));
    const data = toReactFlowEdges(layout)[0].data;

    expect(edgeMarkup(data, nodes, true)).toContain(settled);
  });

  it('uses settled geometry while a live node has no extent', () => {
    const nodes = toReactFlowNodes(layout).map((node) =>
      node.id === elementId('el-client')
        ? { ...node, width: undefined, height: undefined }
        : node,
    );
    const data = toReactFlowEdges(layout)[0].data;

    expect(edgeMarkup(data, nodes)).toContain(settled);
  });

  it('draws nothing where React Flow hands it an edge with no data', () => {
    expect(edgeMarkup(undefined)).toBe('');
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
      style: undefined,
      zIndex: 0,
    });
  });

  it('puts trust boundaries below every other React Flow item', () => {
    expect(toReactFlowNodes(layout)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: elementId('el-zone'),
          style: { pointerEvents: 'none' },
          zIndex: -1,
        }),
        expect.objectContaining({
          id: elementId('el-client'),
          zIndex: 0,
        }),
      ]),
    );
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
      interactionWidth: 20,
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

describe('layoutAtReactFlowNodes', () => {
  it('moves selected flow waypoints by the live group offset', () => {
    const offset = { x: 50, y: 40 };
    const movedNodes = [elementId('el-client'), elementId('el-api')];
    const nodes = toReactFlowNodes(layout).map((node) =>
      node.id === movedNodes[0]
        ? {
            ...node,
            position: {
              x: node.position.x + offset.x,
              y: node.position.y + offset.y,
            },
          }
        : node,
    );
    const edge = layout.edges[0];

    const moved = layoutAtReactFlowNodes(layout, nodes, [
      ...movedNodes,
      edge.id,
    ]);

    expect(moved.edges[0].waypoints).toEqual(
      edge.waypoints.map((point) => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
      })),
    );
    expect(
      moved.nodes.find((node) => node.id === movedNodes[1])?.position,
    ).toEqual({
      x: nodeNamed('el-api').position.x + offset.x,
      y: nodeNamed('el-api').position.y + offset.y,
    });
  });

  it('ignores React Flow anchors that name no diagram node', () => {
    expect(
      layoutAtReactFlowNodes(
        layout,
        [...toReactFlowNodes(layout), ...freeEndNodes(layout)],
        [],
      ).edges,
    ).toHaveLength(layout.edges.length);
  });

  it('falls back to settled extents when React Flow has none', () => {
    const nodes = toReactFlowNodes(layout).map((node) => ({
      ...node,
      measured: undefined,
      width: undefined,
      height: undefined,
    }));

    expect(layoutAtReactFlowNodes(layout, nodes, []).nodes[0].size).toEqual(
      layout.nodes[0].size,
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
