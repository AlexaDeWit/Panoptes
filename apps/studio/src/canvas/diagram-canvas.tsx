import {
  canvasEdgeTypes,
  canvasNodeTypes,
  canvasStylesheet,
  type CanvasFlowEdge,
} from '@panoptes/canvas';
import {
  applyNodeChanges,
  ConnectionMode,
  ReactFlow,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { useMemo, useState } from 'react';
import { useModelStore } from '../store/store.js';
import { applyChanges } from './changes.js';
import { currentLayout, selectedElement } from './layout.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  withMeasurements,
  type DiagramNode,
} from './nodes.js';
import styles from './diagram-canvas.module.css';

/**
 * The diagram, interactive. Everything drawn is derived from the store by
 * selector, so an edit made anywhere in the studio arrives here by the same
 * route a drag does and nothing invalidates the canvas by hand.
 *
 * React Flow is mounted controlled: the nodes and flows it draws come from
 * the model on every render, and the copy held beside the model carries only
 * what React Flow reports about a gesture in flight, the position of a node
 * under the pointer among it, so a drag stays smooth. That copy is folded
 * back onto the model's own nodes as soon as the model moves, during render
 * rather than in an effect, so the canvas draws the store and nothing else.
 * The gesture reaches the store once, when it settles, as one offset, and
 * what it asks of the store is settled against the store's own selection
 * rather than this render's. The reasoning and the limits are in this
 * directory's README.
 */
export function DiagramCanvas() {
  const layout = useModelStore(currentLayout);
  const selection = useModelStore(selectedElement);
  const graph = useMemo(
    () => diagramGraph(layout, selection),
    [layout, selection],
  );
  const elements = useMemo(() => elementIds(layout), [layout]);
  const positions = useMemo(() => nodesById(layout), [layout]);
  const [onScreen, setOnScreen] = useState<DiagramNode[]>(graph.nodes);
  const [folded, setFolded] = useState<DiagramNode[]>(graph.nodes);

  if (folded !== graph.nodes) {
    setFolded(graph.nodes);
    setOnScreen(withMeasurements(graph.nodes, onScreen));
  }

  const onNodesChange = (changes: NodeChange<DiagramNode>[]): void => {
    setOnScreen((current) => applyNodeChanges(changes, current));
    applyChanges(changes, elements, positions);
  };

  const onEdgesChange = (changes: EdgeChange<CanvasFlowEdge>[]): void => {
    applyChanges(changes, elements, positions);
  };

  return (
    <div className={styles.canvas} data-testid="canvas-container">
      <style>{canvasStylesheet}</style>
      <ReactFlow
        aria-label="Diagram"
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        edges={graph.edges}
        edgeTypes={canvasEdgeTypes}
        fitView
        multiSelectionKeyCode={null}
        nodes={onScreen}
        nodesConnectable={false}
        nodeTypes={canvasNodeTypes}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        selectionKeyCode={null}
      />
    </div>
  );
}
