import {
  gridSpacing,
  themedCanvasStylesheet,
  type CanvasFlowEdge,
} from '@panoptes/canvas';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeMouseHandler,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { ElementId } from '@panoptes/model';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { focusThreatPanel } from '../panel/panel-focus.js';
import { ThreatOverlay } from '../panel/threat-overlay.js';
import { keyboardOwner } from '../commands/binding.js';
import { useModelStore } from '../store/store.js';
import {
  applyChanges,
  applyConnection,
  betweenTwoElements,
} from './changes.js';
import { beginRenaming, drawnElement, removeSelected } from './edits.js';
import { currentLayout, selectedElement } from './layout.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  withMeasurements,
  type DiagramNode,
} from './nodes.js';
import { renamingEdgeTypes, renamingNodeTypes } from './rename-field.js';
import { FitOnOpen } from './view-commands.js';
import {
  clearOfPanel,
  nodeInView,
  revealCentre,
  zoomLimits,
} from './viewport.js';
import { ZoomCluster } from './zoom-cluster.js';
import styles from './diagram-canvas.module.css';

const deleteKeys = new Set(['Delete', 'Backspace']);

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
 * What counts as in view is what the threat panel is not over: the panel
 * opens on the same selection this pans for, so an element under it is an
 * element out of sight ([the panel](../panel/README.md)).
 *
 * The panel is mounted here rather than beside the canvas, because that is
 * what makes it an overlay on the diagram rather than a column taken off it.
 * How much of the canvas it covers is one token, which the panel is drawn
 * from and the pan reads, so the width the panel draws and the width the pan
 * reasons about are one number.
 * Enter on the element the store has selected hands it the keyboard, which is
 * read in the capture phase: React Flow answers Enter on a node itself, and
 * by the time the press has bubbled the selection it reports has already
 * moved, so a press read on the way up could not tell selecting an element
 * from asking for the panel of one already selected.
 *
 * The ground is graph paper: React Flow's own background component ruled at
 * the token module's grid spacing, so the lines scale with the viewport and a
 * zoom reads as one. Its colour comes from the studio's own custom property,
 * which the CSS module beside this file hands React Flow.
 *
 * The diagram's own colours arrive the same way. The sheet injected here is
 * the canvas package's property-reading projection, so the drawing follows
 * whichever table the app root resolved and no component learns which mode it
 * is in. What the CLI writes keeps the light values.
 *
 * The view is fitted to the diagram whenever a model arrives rather than on
 * mount alone, which is React Flow's own `fitView`: a file opened over the
 * model before it would otherwise be drawn at that model's zoom and mostly
 * off screen. The calculation and the room it leaves for the floating chrome
 * are `viewport.ts`, and `FitOnOpen` is what applies it, from inside React
 * Flow, which is what holds the canvas's extent.
 *
 * Deleting is bound here rather than left to React Flow, whose delete key
 * listens on the whole document and would remove the selected element from
 * anywhere in the studio, and whose cascade over the flows attached to it is
 * not the model's. One key press asks the store for one removal and the model
 * settles the rest. Focus lands on the canvas afterwards, the element that
 * held it having gone. A press typed into a control that takes characters is
 * left to that control, so Backspace inside the rename field corrects the
 * name rather than deleting what it renames.
 *
 * A double-click renames what it lands on, which is why React Flow's own
 * double-click zoom is off: a gesture means one thing, and zooming has a
 * chord and a control of its own.
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
    if (nodeInView(node, viewport, clearOfPanel(extent))) {
      return;
    }
    const centre = revealCentre(node, viewport.zoom);
    void instance.setCenter(centre.x, centre.y, { zoom: viewport.zoom });
  }, [positions, selection]);

  const onNodesChange = (changes: NodeChange<DiagramNode>[]): void => {
    setOnScreen((current) => applyNodeChanges(changes, current));
    applyChanges(changes, elements, positions);
  };

  const onEdgesChange = (changes: EdgeChange<CanvasFlowEdge>[]): void => {
    applyChanges(changes, elements, positions);
  };

  const onConnect = (connection: Connection): void => {
    applyConnection(connection, elements);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (keyboardOwner(event.target) !== 'page' || !deleteKeys.has(event.key)) {
      return;
    }
    if (!removeSelected()) {
      return;
    }
    event.preventDefault();
    surface.current?.focus();
  };

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' || selection === undefined) {
      return;
    }
    if (
      drawnElement(event.target, elements) !== selection ||
      !focusThreatPanel()
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const onRename = useCallback(
    (id: string): void => {
      const element = elements.get(id);
      if (element !== undefined) {
        beginRenaming(element);
      }
    },
    [elements],
  );

  // A pointer double-click renames the element it lands on. It is read here,
  // over the whole canvas, rather than from React Flow's node double-click,
  // because selecting a node opens the threat panel and pans the node clear
  // of it between the two clicks: the second click lands on the pane the node
  // has left, so no node hears both. The element the first click of the pair
  // fell on is what is renamed, found once and held, and the browser's own
  // click count is what tells the pair from two separate clicks.
  const clickedFirst = useRef<ElementId | undefined>(undefined);

  const onCanvasClickCapture = (event: MouseEvent<HTMLDivElement>): void => {
    if (
      !(event.target instanceof Element) ||
      event.target.closest('input, textarea, button') !== null
    ) {
      return;
    }
    if (event.detail > 1) {
      const element = clickedFirst.current;
      if (element !== undefined) {
        beginRenaming(element);
      }
      return;
    }
    clickedFirst.current = drawnElement(event.target, elements);
  };

  const onEdgeDoubleClick = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      onRename(edge.id);
    },
    [onRename],
  );

  return (
    <div
      className={styles.canvas}
      data-testid="canvas-container"
      onClickCapture={onCanvasClickCapture}
      onKeyDownCapture={onKeyDownCapture}
    >
      <style>{themedCanvasStylesheet}</style>
      <ReactFlow
        aria-label="Diagram"
        attributionPosition="bottom-left"
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        edges={graph.edges}
        edgeTypes={renamingEdgeTypes}
        isValidConnection={betweenTwoElements}
        maxZoom={zoomLimits.maximum}
        minZoom={zoomLimits.minimum}
        multiSelectionKeyCode={null}
        nodes={onScreen}
        nodesConnectable
        nodeTypes={renamingNodeTypes}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          view.current = instance;
        }}
        onKeyDown={onKeyDown}
        onNodesChange={onNodesChange}
        ref={surface}
        selectionKeyCode={null}
        tabIndex={-1}
        zoomOnDoubleClick={false}
      >
        <Background gap={gridSpacing} variant={BackgroundVariant.Lines} />
        <FitOnOpen />
      </ReactFlow>
      <ZoomCluster />
      <ThreatOverlay />
    </div>
  );
}
