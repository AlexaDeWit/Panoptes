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
} from '@panoptes/canvas';
import type { ElementId } from '@panoptes/model';
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
import { announce } from './announcements.js';
import { commitRename, endRenaming } from './edits.js';
import { edgeLabel, nodeLabel } from './names.js';
import styles from './rename-field.module.css';

type Draft = { readonly shown: string; readonly text: string };

const emptyRefusal = 'A name cannot be empty.';

function refusedName(label: string, text: string): TextRefusal | undefined {
  return text === ''
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

/** Which element the field renames, what it is labelled, and its name now. */
export type NameFieldProps = {
  readonly elementId: ElementId;
  readonly label: string;
  readonly name: string;
};

/**
 * The name of one element, edited where it is drawn. Enter commits, Escape
 * cancels and leaves the model's own name, and leaving the field commits as
 * well, so a rename settles however a person leaves it. Focus goes back to
 * the element either way, the field having been drawn over it.
 *
 * What is typed is the field's until it is committed, which is what keeps a
 * name the model refuses on screen to be corrected. A refusal is said in the
 * canvas's live region with the field named, since a refusal that lands as
 * focus leaves would otherwise be silent, and it is shown under the field
 * with the character named ([the controls](../ui/README.md)). The field
 * follows the name it is given whenever that moves, so an undo taken while
 * it is open lands in it.
 */
export function NameField({ elementId, label, name }: NameFieldProps) {
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

  const close = (): void => {
    settled.current = true;
    endRenaming(elementId);
  };

  const commit = (): void => {
    const refused = refusedName(label, draft.text);
    setRefusal(refused);
    if (refused === undefined) {
      commitRename(elementId, draft.text);
      close();
      return;
    }
    announce(refused.said);
  };

  return (
    <>
      <input
        aria-describedby={refusal === undefined ? undefined : refusalId}
        aria-invalid={refusal !== undefined}
        aria-label={label}
        className={`${styles.field} nodrag nopan`}
        onBlur={() => {
          if (!settled.current) {
            commit();
          }
        }}
        onChange={(event) => {
          setDraft({ shown: name, text: event.target.value });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
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

/**
 * One element as a React Flow node, with the field over its name while the
 * store has that name open. The drawing is the canvas package's own and is
 * untouched: the field is the studio's, mounted beside it and placed where
 * the glyph draws the name, so the two cannot sit apart.
 *
 * The subscription answers whether this node is the one being renamed rather
 * than which node is, so a rename re-renders that node alone, and the
 * selector is held across renders so a node React Flow redraws mid-drag reads
 * the store no more often than it did before there was a field to mount.
 */
export function RenamingNodeBody(props: NodeProps<CanvasFlowNode>) {
  const { node } = props.data;
  const renaming = useModelStore(
    useCallback((state: State) => state.renaming === node.id, [node.id]),
  );

  return (
    <>
      <CanvasNodeBody {...props} />
      {renaming && (
        <div
          className={styles.overNode}
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

/**
 * One flow as a React Flow edge, with the field over its label on the same
 * terms. The label's placement is the one the layout settled over the whole
 * diagram, so the field lands where the name was drawn rather than at a
 * midpoint of its own. It rides in React Flow's edge label layer, an edge
 * itself being drawn in an SVG that no field can sit in.
 */
export function RenamingEdgeBody(props: EdgeProps<CanvasFlowEdge>) {
  const edge = props.data?.edge;
  const renaming = useModelStore(
    useCallback((state: State) => state.renaming === edge?.id, [edge?.id]),
  );

  return (
    <>
      <CanvasEdgeBody {...props} />
      {renaming && edge !== undefined && (
        <EdgeLabelRenderer>
          <div className={styles.overFlow} style={placedAt(edge.label.name)}>
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
 * element kind, each able to carry the rename field, and the anchor a flow's
 * free end rides on, which draws nothing and is renamed by nothing.
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

/** The edge type the studio mounts, which is a flow that carries the field. */
export const renamingEdgeTypes = { flow: RenamingEdgeBody } as const;
