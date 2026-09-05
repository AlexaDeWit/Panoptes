import {
  canvasEdgeTypes,
  canvasNodeTypes,
  canvasStylesheet,
  centreOf,
  type CanvasFlowEdge,
} from '@panoptes/canvas';
import {
  applyNodeChanges,
  ConnectionMode,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { ElementId } from '@panoptes/model';
import { useModelStore } from '../store/store.js';
import { applyChanges } from './changes.js';
import { connectElements, removeSelected } from './edits.js';
import { currentLayout, selectedElement } from './layout.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  withMeasurements,
  type DiagramNode,
} from './nodes.js';
import { nodeInView } from './viewport.js';
import styles from './diagram-canvas.module.css';

const deleteKeys = new Set(['Delete', 'Backspace']);

const betweenTwoElements = (connection: Connection | Edge): boolean =>
  connection.source !== connection.target;

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
 *
 * The canvas pans to the element a selection moves to where the whole of it
 * is not in view, which is what makes an element added off screen worth
 * selecting and focusing: React Flow pans to a focused node of its own
 * accord, but only where the node is wholly outside the view and the focus
 * came from the keyboard, and an edit's focus is neither. It is the move that
 * pans, not the model changing under a selection that stays, so dragging the
 * selected element to the edge of the canvas leaves it where it was dropped.
 *
 * Deleting is bound here rather than left to React Flow, whose delete key
 * listens on the whole document and would remove the selected element from
 * anywhere in the studio, and whose cascade over the flows attached to it is
 * not the model's. One key press asks the store for one removal and the model
 * settles the rest. Focus lands on the canvas afterwards, the element that
 * held it having gone.
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
  const surface = useRef<HTMLDivElement>(null);
  const view = useRef<ReactFlowInstance<DiagramNode, CanvasFlowEdge> | null>(
    null,
  );
  const revealed = useRef<ElementId | undefined>(undefined);

  if (folded !== graph.nodes) {
    setFolded(graph.nodes);
    setOnScreen(withMeasurements(graph.nodes, onScreen));
  }

  useEffect(() => {
    if (revealed.current === selection) {
      return;
    }
    revealed.current = selection;
    const node = selection === undefined ? undefined : positions.get(selection);
    const extent = surface.current?.getBoundingClientRect();
    const instance = view.current;
    if (node === undefined || extent === undefined || instance === null) {
      return;
    }
    const viewport = instance.getViewport();
    if (nodeInView(node, viewport, extent)) {
      return;
    }
    const centre = centreOf(node);
    void instance.setCenter(centre.x, centre.y, { zoom: viewport.zoom });
  }, [positions, selection]);

  const onNodesChange = (changes: NodeChange<DiagramNode>[]): void => {
    setOnScreen((current) => applyNodeChanges(changes, current));
    applyChanges(changes, elements, positions);
  };

  const onEdgesChange = (changes: EdgeChange<CanvasFlowEdge>[]): void => {
    applyChanges(changes, elements, positions);
  };

  const onConnect = ({ source, target }: Connection): void => {
    const from = elements.get(source);
    const to = elements.get(target);
    if (from !== undefined && to !== undefined) {
      connectElements(from, to);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!deleteKeys.has(event.key) || !removeSelected()) {
      return;
    }
    event.preventDefault();
    surface.current?.focus();
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
        isValidConnection={betweenTwoElements}
        multiSelectionKeyCode={null}
        nodes={onScreen}
        nodesConnectable
        nodeTypes={canvasNodeTypes}
        onConnect={onConnect}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          view.current = instance;
        }}
        onKeyDown={onKeyDown}
        onNodesChange={onNodesChange}
        ref={surface}
        selectionKeyCode={null}
        tabIndex={-1}
      />
    </div>
  );
}
