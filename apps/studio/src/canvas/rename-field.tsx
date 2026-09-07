import {
  CanvasEdgeBody,
  CanvasFreeEndBody,
  CanvasNodeBody,
  freeEndNodeKind,
  nodeTextPlacement,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeKind,
  type TextPlacement,
} from '@saerskriven/canvas';
import { isEmptyName, type ElementId } from '@saerskriven/model';
import {
  EdgeLabelRenderer,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { State } from '../store/state.js';
import { useModelStore } from '../store/store.js';
import { refusedText, type TextRefusal } from '../ui/text-field.js';
import { announce, resetAnnouncements } from './announcements.js';
import { commitRename, endRenaming, stopRenaming } from './edits.js';
import { edgeLabel, nodeLabel } from './names.js';
import styles from './rename-field.module.css';

type Draft = { readonly shown: string; readonly text: string };

type NameFieldProps = {
  readonly elementId: ElementId;
  readonly label: string;
  readonly name: string;
};

const emptyRefusal = 'A name cannot be empty.';

function refusedName(label: string, text: string): TextRefusal | undefined {
  return isEmptyName(text)
    ? { shown: emptyRefusal, said: `${label} was not saved. ${emptyRefusal}` }
    : refusedText(label, text);
}

function placedAt(placement: TextPlacement): CSSProperties {
  return {
    left: `${String(placement.at.x)}px`,
    top: `${String(placement.at.y)}px`,
    width: `${String(placement.width)}px`,
    transform:
      placement.anchor === 'top'
        ? 'translate(-50%, 0)'
        : 'translate(-50%, -50%)',
  };
}

function NameField({ elementId, label, name }: NameFieldProps) {
  const refusalId = useId();
  const field = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  const [draft, setDraft] = useState<Draft>({ shown: name, text: name });
  const [refusal, setRefusal] = useState<TextRefusal | undefined>(undefined);

  if (draft.shown !== name) {
    setDraft({ shown: name, text: name });
    setRefusal(undefined);
  }

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  const cancel = (): void => {
    settled.current = true;
    endRenaming(elementId);
  };

  const commit = (handBack: boolean): void => {
    const refused = refusedName(label, draft.text);
    setRefusal(refused);
    if (refused !== undefined) {
      announce(refused.said);
      return;
    }
    commitRename(elementId, draft.text);
    settled.current = true;
    if (handBack) {
      endRenaming(elementId);
    } else {
      stopRenaming();
    }
  };

  return (
    <>
      <input
        aria-describedby={refusal === undefined ? undefined : refusalId}
        aria-invalid={refusal !== undefined}
        aria-label={label}
        className={styles.field}
        onBlur={() => {
          if (!settled.current) {
            commit(false);
          }
        }}
        onChange={(event) => {
          resetAnnouncements();
          setDraft({ shown: name, text: event.target.value });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(true);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
        ref={field}
        type="text"
        value={draft.text}
      />
      {refusal !== undefined && (
        <p className={styles.refusal} id={refusalId}>
          {refusal.shown}
        </p>
      )}
    </>
  );
}

function RenamingNodeBody(props: NodeProps<CanvasFlowNode>) {
  const { node } = props.data;
  const renaming = useModelStore(
    useCallback((state: State) => state.renaming === node.id, [node.id]),
  );

  return (
    <>
      <CanvasNodeBody {...props} controlsVisible={!renaming} />
      {renaming && (
        <div
          className={`${styles.overNode} nodrag nopan`}
          style={placedAt(nodeTextPlacement(node))}
        >
          <NameField
            elementId={node.id}
            label={`Name of ${nodeLabel(node)}`}
            name={node.name}
          />
        </div>
      )}
    </>
  );
}

function RenamingEdgeBody(props: EdgeProps<CanvasFlowEdge>) {
  const edge = props.data?.edge;
  const renaming = useModelStore(
    useCallback((state: State) => state.renaming === edge?.id, [edge?.id]),
  );

  return (
    <>
      <CanvasEdgeBody {...props} />
      {renaming && edge !== undefined && (
        <EdgeLabelRenderer>
          <div
            className={`${styles.overFlow} nodrag nopan`}
            style={placedAt(edge.label.name)}
          >
            <NameField
              elementId={edge.id}
              label={`Name of ${edgeLabel(edge)}`}
              name={edge.name}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/**
 * The node types the studio mounts: the canvas package's drawing of every
 * element kind, wrapped so it can carry a field over the name while the store
 * has that name open, and the anchor a flow's free end rides on, which draws
 * nothing and is renamed by nothing. The drawing itself is untouched; the
 * field is the studio's, placed where the glyph draws the name so the two
 * cannot sit apart.
 *
 * Each node subscribes to whether it is the one being renamed rather than to
 * which node is, so a rename re-renders that node alone, and its selector is
 * held across renders so a node React Flow redraws mid-drag reads the store no
 * more often than it did before there was a field to mount.
 *
 * What the field then does is [the canvas](README.md): Enter commits and
 * Escape leaves the model's name, both handing focus back to the element,
 * while leaving the field commits and leaves focus where the person put it.
 */
export const renamingNodeTypes = {
  actor: RenamingNodeBody,
  process: RenamingNodeBody,
  store: RenamingNodeBody,
  text: RenamingNodeBody,
  'boundary-box': RenamingNodeBody,
  'boundary-curve': RenamingNodeBody,
  [freeEndNodeKind]: CanvasFreeEndBody,
} as const satisfies Record<CanvasNodeKind, typeof RenamingNodeBody> &
  Record<typeof freeEndNodeKind, typeof CanvasFreeEndBody>;

/**
 * The edge type the studio mounts, which is a flow carrying the same field
 * over its label, at the placement the layout settled over the whole diagram
 * rather than at a midpoint of its own. It rides in React Flow's edge label
 * layer, an edge itself being drawn in an SVG that no field can sit in.
 */
export const renamingEdgeTypes = { flow: RenamingEdgeBody } as const;
