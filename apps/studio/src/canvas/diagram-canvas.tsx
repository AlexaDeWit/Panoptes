import {
  gridSpacing,
  themedCanvasStylesheet,
  type CanvasFlowEdge,
} from '@saerskriven/canvas';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  type Connection,
  type EdgeChange,
  type EdgeMouseHandler,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { ElementId } from '@saerskriven/model';
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
import { selectedElement, selectedElements } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import {
  applyChanges,
  applyConnection,
  betweenTwoElements,
} from './changes.js';
import { beginRenaming, drawnElement, removeSelected } from './edits.js';
import { EmptyStateHint } from './empty-state-hint.js';
import { currentLayout } from './layout.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  withMeasurements,
  type DiagramNode,
} from './nodes.js';
import { renamingEdgeTypes, renamingNodeTypes } from './rename-field.js';
import { PlacementPreview, usePlacement } from './placement.js';
import { Toolbox } from './toolbox.js';
import { currentTool } from './tools.js';
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

/** The controlled diagram canvas and its floating editing controls. */
export function DiagramCanvas() {
  const layout = useModelStore(currentLayout);
  const selection = useModelStore(selectedElements);
  const selected = useModelStore(selectedElement);
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
  const placement = usePlacement(surface, view, layout);
  const { mode } = placement;

  if (folded !== graph.nodes) {
    setFolded(graph.nodes);
    setOnScreen(withMeasurements(graph.nodes, onScreen));
  }

  useEffect(() => {
    if (revealed.current === selected) {
      return;
    }
    revealed.current = selected;
    const node = selected === undefined ? undefined : positions.get(selected);
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
  }, [positions, selected]);

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
    if (
      currentTool().active !== 'select' ||
      event.key !== 'Enter' ||
      event.shiftKey ||
      selected === undefined ||
      keyboardOwner(event.target) !== 'page'
    ) {
      return;
    }
    if (
      drawnElement(event.target, elements) !== selected ||
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

  // Selection can pan a node between two clicks. Retain the first click's
  // element so the second click still renames it.
  const clickedFirst = useRef<ElementId | undefined>(undefined);

  const onCanvasClickCapture = (event: MouseEvent<HTMLDivElement>): void => {
    if (
      !(event.target instanceof Element) ||
      event.target.closest('input, textarea, button') !== null
    ) {
      return;
    }
    if (placement.click(event)) {
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
      data-active-tool={mode.active}
      data-tool={
        mode.active === 'select'
          ? undefined
          : mode.active === 'hand'
            ? 'hand'
            : 'place'
      }
      data-testid="canvas-container"
      onClickCapture={onCanvasClickCapture}
      onKeyDownCapture={onKeyDownCapture}
      onPointerCancelCapture={placement.pointerCancel}
      onPointerDownCapture={placement.pointerDown}
      onPointerMoveCapture={placement.pointerMove}
      onPointerUpCapture={placement.pointerUp}
    >
      <style>{themedCanvasStylesheet}</style>
      <ReactFlow
        aria-label="Diagram"
        attributionPosition="bottom-left"
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        edges={graph.edges}
        edgeTypes={renamingEdgeTypes}
        elementsSelectable={mode.active === 'select'}
        isValidConnection={betweenTwoElements}
        maxZoom={zoomLimits.maximum}
        minZoom={zoomLimits.minimum}
        multiSelectionKeyCode="Shift"
        nodes={onScreen}
        nodesConnectable={mode.active === 'select'}
        nodesDraggable={mode.active === 'select'}
        nodeTypes={renamingNodeTypes}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          view.current = instance;
        }}
        onKeyDown={onKeyDown}
        onNodesChange={onNodesChange}
        panActivationKeyCode={null}
        panOnDrag={mode.active === 'hand'}
        ref={surface}
        selectionKeyCode={null}
        selectionMode={SelectionMode.Full}
        selectionOnDrag={mode.active === 'select'}
        tabIndex={-1}
        zoomOnDoubleClick={false}
      >
        <Background gap={gridSpacing} variant={BackgroundVariant.Lines} />
        <PlacementPreview points={placement.preview} />
        <FitOnOpen />
      </ReactFlow>
      <EmptyStateHint />
      <Toolbox />
      <ZoomCluster />
      <ThreatOverlay />
    </div>
  );
}
