import {
  flowLabelFollows,
  gridSpacing,
  layoutAtReactFlowNodes,
  themedCanvasStylesheet,
  type CanvasEdge,
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
  type PointerEvent,
} from 'react';
import { ThreatOverlay } from '../panel/threat-overlay.js';
import { Action } from '../store/actions.js';
import { keyboardOwner } from '../commands/binding.js';
import { selectedElement, selectedElements } from '../store/selectors.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import {
  applyChanges,
  applyConnection,
  betweenTwoElements,
  gestureSelection,
} from './changes.js';
import { beginEditingText, drawnElement, removeSelected } from './edits.js';
import { currentLayout } from './layout.js';
import {
  canvasEdgesById,
  diagramGraph,
  elementIds,
  nodesById,
  withMeasurements,
  withLiveEdges,
  type DiagramNode,
} from './nodes.js';
import { editingEdgeTypes, editingNodeTypes } from './rename-field.js';
import { PlacementPreview } from './placement-preview.js';
import { usePlacement } from './placement.js';
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
const exactLabelDelay = 50;
const mouseButtonsForTouchPanOnly: number[] = [];
const canvasA11y = {
  'node.a11yDescription.keyboardDisabled':
    'Press Enter or Space to select this item. If it is selected, press Enter to edit its text. Press Shift and Enter to change a group selection. Use arrow keys to move a selection. Holding Space also uses Hand. Press T to focus threats, Delete to remove the selection, or Escape to cancel.',
  'edge.a11yDescription.default':
    'Press Enter or Space to select this flow. If it is selected, press Enter to edit its name. Press Shift and Enter to change a group selection. Holding Space also uses Hand. Press T to focus threats, Delete to remove the selection, or Escape to cancel.',
};

type ScreenPoint = { readonly x: number; readonly y: number };

function containedFlows(
  root: HTMLDivElement | null,
  from: ScreenPoint,
  to: ScreenPoint,
  elements: ReadonlyMap<string, ElementId>,
): ElementId[] {
  if (root === null) {
    return [];
  }
  const bounds = {
    left: Math.min(from.x, to.x),
    top: Math.min(from.y, to.y),
    right: Math.max(from.x, to.x),
    bottom: Math.max(from.y, to.y),
  };
  return [...root.querySelectorAll('.react-flow__edge')].flatMap((flow) => {
    const drawn = flow.getBoundingClientRect();
    const id = elements.get(flow.getAttribute('data-id') ?? '');
    return id !== undefined &&
      drawn.left >= bounds.left &&
      drawn.top >= bounds.top &&
      drawn.right <= bounds.right &&
      drawn.bottom <= bounds.bottom
      ? [id]
      : [];
  });
}

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
  const [exactEdges, setExactEdges] = useState<CanvasFlowEdge[] | undefined>();
  const [moving, setMoving] = useState(false);
  const edgeBases = useRef<ReadonlyMap<string, CanvasEdge>>(new Map());
  const movingElements = useRef<readonly ElementId[]>(selection);
  const surface = useRef<HTMLDivElement>(null);
  const boxSelecting = useRef(false);
  const boxStart = useRef<ScreenPoint | undefined>(undefined);
  const view = useRef<ReactFlowInstance<DiagramNode, CanvasFlowEdge> | null>(
    null,
  );
  const revealed = useRef<ElementId | undefined>(undefined);
  const placement = usePlacement(surface, view, layout);
  const { mode } = placement;

  if (folded !== graph.nodes) {
    setFolded(graph.nodes);
    setOnScreen(withMeasurements(graph.nodes, onScreen));
    setExactEdges(undefined);
  }

  useEffect(() => {
    if (!moving) {
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      const paused = layoutAtReactFlowNodes(
        layout,
        onScreen,
        movingElements.current,
        false,
        edgeBases.current,
      );
      setExactEdges(withLiveEdges(graph.edges, paused));
      edgeBases.current = canvasEdgesById(paused);
    }, exactLabelDelay);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [graph.edges, layout, moving, onScreen]);

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
    const next = applyNodeChanges(changes, onScreen);
    setOnScreen(next);
    const active = changes.some(
      (change) =>
        (change.type === 'position' && change.dragging === true) ||
        (change.type === 'dimensions' && change.resizing === true),
    );
    const finished = changes.some(
      (change) =>
        (change.type === 'position' && change.dragging === false) ||
        (change.type === 'dimensions' && change.resizing === false),
    );
    if (active || finished) {
      movingElements.current = gestureSelection(changes, positions, selection);
      setMoving(active);
    }
    if (active || finished) {
      const live = layoutAtReactFlowNodes(
        layout,
        next,
        movingElements.current,
        finished,
        edgeBases.current,
      );
      const candidateChanged = live.edges.some((edge) => {
        const base = edgeBases.current.get(edge.id);
        return (
          base === undefined || (base !== edge && !flowLabelFollows(base, edge))
        );
      });
      if (finished || candidateChanged) {
        setExactEdges(withLiveEdges(graph.edges, live));
        edgeBases.current = canvasEdgesById(live);
      }
    }
    applyChanges(changes, elements, positions);
  };

  const onEdgesChange = (changes: EdgeChange<CanvasFlowEdge>[]): void => {
    const accepted = boxSelecting.current
      ? changes.filter((change) => change.type !== 'select' || !change.selected)
      : changes;
    applyChanges(accepted, elements, positions);
  };

  const onConnect = (connection: Connection): void => {
    applyConnection(connection, elements);
  };

  const onPointerDownCapture = (event: PointerEvent<HTMLDivElement>): void => {
    edgeBases.current = canvasEdgesById(layout);
    if (
      mode.active === 'select' &&
      event.pointerType !== 'touch' &&
      event.button === 0 &&
      event.target instanceof Element &&
      event.target.matches('.react-flow__pane')
    ) {
      boxStart.current = { x: event.clientX, y: event.clientY };
    }
    placement.pointerDown(event);
  };

  const finishBoxSelection = (at: ScreenPoint): void => {
    boxSelecting.current = false;
    const from = boxStart.current;
    boxStart.current = undefined;
    if (from === undefined) {
      return;
    }
    const flowIds = containedFlows(surface.current, from, at, elements);
    if (flowIds.length > 0) {
      const currentSelection = selectedElements(modelStore.getState());
      dispatch(
        Action.Select({ elementIds: [...currentSelection, ...flowIds] }),
      );
    }
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
      keyboardOwner(event.target) !== 'page'
    ) {
      return;
    }
    const element = drawnElement(event.target, elements);
    if (element === undefined) {
      return;
    }
    if (event.shiftKey) {
      const nextSelection = selection.includes(element)
        ? selection.filter((selectedId) => selectedId !== element)
        : [...selection, element];
      dispatch(Action.Select({ elementIds: nextSelection }));
    } else if (selection.length > 1) {
      dispatch(Action.Select({ elementIds: [element] }));
    } else if (element !== selected || !beginEditingText(element)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const onEditText = useCallback(
    (id: string): void => {
      const element = elements.get(id);
      if (element !== undefined) {
        beginEditingText(element);
      }
    },
    [elements],
  );

  const firstClickBeforeSelectionPan = useRef<ElementId | undefined>(undefined);

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
      const element = firstClickBeforeSelectionPan.current;
      if (element !== undefined) {
        beginEditingText(element);
      }
      return;
    }
    const element = drawnElement(event.target, elements);
    firstClickBeforeSelectionPan.current = element;
    if (!event.shiftKey && selection.length > 1 && element !== undefined) {
      dispatch(Action.Select({ elementIds: [element] }));
    }
  };

  const onEdgeDoubleClick = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      onEditText(edge.id);
    },
    [onEditText],
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
      onPointerCancelCapture={(event) => {
        boxSelecting.current = false;
        boxStart.current = undefined;
        placement.pointerCancel(event);
      }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={placement.pointerMove}
      onPointerUpCapture={placement.pointerUp}
    >
      <style>{themedCanvasStylesheet}</style>
      <ReactFlow
        aria-label="Diagram"
        ariaLabelConfig={canvasA11y}
        attributionPosition="bottom-left"
        autoPanOnSelection={false}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={null}
        edges={exactEdges ?? graph.edges}
        edgeTypes={editingEdgeTypes}
        elementsSelectable={mode.active === 'select'}
        isValidConnection={betweenTwoElements}
        maxZoom={zoomLimits.maximum}
        minZoom={zoomLimits.minimum}
        multiSelectionKeyCode="Shift"
        nodes={onScreen}
        nodesConnectable={mode.active === 'select'}
        nodesDraggable={mode.active === 'select'}
        nodeTypes={editingNodeTypes}
        onConnect={onConnect}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onEdgesChange={onEdgesChange}
        onInit={(instance) => {
          view.current = instance;
        }}
        onKeyDown={onKeyDown}
        onNodesChange={onNodesChange}
        onSelectionEnd={(event) => {
          finishBoxSelection({ x: event.clientX, y: event.clientY });
        }}
        onSelectionStart={() => {
          boxSelecting.current = true;
        }}
        panActivationKeyCode={null}
        panOnDrag={
          mode.active === 'hand'
            ? true
            : mode.active === 'select'
              ? mouseButtonsForTouchPanOnly
              : false
        }
        panOnScroll
        ref={surface}
        selectionKeyCode={null}
        selectionMode={SelectionMode.Full}
        selectionOnDrag={mode.active === 'select'}
        tabIndex={-1}
        zoomOnDoubleClick={false}
        zoomOnScroll={false}
        zIndexMode="manual"
      >
        <Background gap={gridSpacing} variant={BackgroundVariant.Lines} />
        <PlacementPreview preview={placement.preview} />
        <FitOnOpen />
      </ReactFlow>
      <Toolbox />
      <ZoomCluster />
      <ThreatOverlay />
    </div>
  );
}
