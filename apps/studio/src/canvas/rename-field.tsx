import {
  CanvasEdgeBody,
  CanvasFreeEndBody,
  CanvasNodeBody,
  canvasType,
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
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import type { State } from '../store/state.js';
import { useModelStore } from '../store/store.js';
import {
  refusedText,
  useTextDraft,
  type RefusedDraft,
  type TextRefusal,
} from '../ui/text-field.js';
import { announce, resetAnnouncements } from './announcements.js';
import {
  commitNote,
  commitRename,
  endInlineEditing,
  stopInlineEditing,
} from './edits.js';
import { edgeLabel, nodeLabel } from './names.js';
import styles from './rename-field.module.css';

type InlineFieldProps = {
  readonly elementId: ElementId;
  readonly label: string;
  readonly value: string;
  readonly multiline?: boolean;
  readonly onCommit: (elementId: ElementId, text: string) => void;
  readonly refuse?: (label: string, text: string) => TextRefusal | undefined;
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

function InlineField({
  elementId,
  label,
  value,
  multiline = false,
  onCommit,
  refuse = refusedText,
}: InlineFieldProps) {
  const refusalId = useId();
  const inputField = useRef<HTMLInputElement>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);
  const settled = useRef(false);
  const reportRefusal = useCallback((refused: RefusedDraft | undefined) => {
    if (refused !== undefined) {
      announce(refused.said);
    }
  }, []);
  const draft = useTextDraft(
    label,
    value,
    undefined,
    (text) => {
      onCommit(elementId, text);
    },
    reportRefusal,
    refuse,
  );

  useEffect(() => {
    const field = multiline ? noteField.current : inputField.current;
    field?.focus();
    field?.select();
  }, [multiline]);

  const cancel = (): void => {
    settled.current = true;
    endInlineEditing(elementId);
  };

  const commit = (handBack: boolean): void => {
    if (!draft.commit()) {
      return;
    }
    settled.current = true;
    if (handBack) {
      endInlineEditing(elementId);
    } else {
      stopInlineEditing();
    }
  };

  const keyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    if (
      event.key === 'Enter' &&
      (!multiline || event.ctrlKey || event.metaKey)
    ) {
      event.preventDefault();
      commit(true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };
  const shared = {
    'aria-describedby': draft.refusal === undefined ? undefined : refusalId,
    'aria-invalid': draft.refusal !== undefined,
    'aria-label': label,
    className: `${styles.field}${multiline ? ` ${styles.note}` : ''}`,
    style: { fontSize: `${String(canvasType.widgetLabel)}px` },
    onBlur: () => {
      if (!settled.current) {
        commit(false);
      }
    },
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      resetAnnouncements();
      draft.change(event.target.value);
    },
    onKeyDown: keyDown,
    value: draft.text,
  };

  return (
    <>
      {multiline ? (
        <textarea {...shared} ref={noteField} />
      ) : (
        <input {...shared} ref={inputField} type="text" />
      )}
      {draft.refusal !== undefined && (
        <p className={styles.refusal} id={refusalId}>
          {draft.refusal.shown}
        </p>
      )}
    </>
  );
}

function EditingNodeBody(props: NodeProps<CanvasFlowNode>) {
  const { node } = props.data;
  const editor = useModelStore(
    useCallback(
      (state: State) =>
        state.inlineEditor?.elementId === node.id
          ? state.inlineEditor
          : undefined,
      [node.id],
    ),
  );
  const editingName = editor?.kind === 'name' && node.kind !== 'text';
  const editingNote = editor?.kind === 'note' && node.kind === 'text';
  const editing = editingName || editingNote;

  return (
    <>
      <CanvasNodeBody {...props} controlsVisible={!editing} />
      {editingName && (
        <div
          className={`${styles.overNode} nodrag nopan`}
          style={placedAt(nodeTextPlacement(node))}
        >
          <InlineField
            elementId={node.id}
            label={`Name of ${nodeLabel(node)}`}
            onCommit={commitRename}
            refuse={refusedName}
            value={node.name}
          />
        </div>
      )}
      {editingNote && (
        <div className={`${styles.overNote} nodrag nopan`}>
          <InlineField
            elementId={node.id}
            label="Note text"
            multiline
            onCommit={commitNote}
            value={node.text}
          />
        </div>
      )}
    </>
  );
}

function EditingEdgeBody(props: EdgeProps<CanvasFlowEdge>) {
  const edge = props.data?.edge;
  const editing = useModelStore(
    useCallback(
      (state: State) =>
        state.inlineEditor?.kind === 'name' &&
        state.inlineEditor.elementId === edge?.id,
      [edge?.id],
    ),
  );

  return (
    <>
      <CanvasEdgeBody {...props} />
      {editing && edge !== undefined && (
        <EdgeLabelRenderer>
          <div
            className={`${styles.overFlow} nodrag nopan`}
            style={placedAt(edge.label.name)}
          >
            <InlineField
              elementId={edge.id}
              label={`Name of ${edgeLabel(edge)}`}
              onCommit={commitRename}
              refuse={refusedName}
              value={edge.name}
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/**
 * The canvas node types, with an inline name or Note editor when requested.
 * Each node subscribes only to its own editor state.
 */
export const editingNodeTypes = {
  actor: EditingNodeBody,
  process: EditingNodeBody,
  store: EditingNodeBody,
  text: EditingNodeBody,
  'boundary-box': EditingNodeBody,
  'boundary-curve': EditingNodeBody,
  [freeEndNodeKind]: CanvasFreeEndBody,
} as const satisfies Record<CanvasNodeKind, typeof EditingNodeBody> &
  Record<typeof freeEndNodeKind, typeof CanvasFreeEndBody>;

/**
 * The flow edge type, with its name editor in React Flow's label layer.
 */
export const editingEdgeTypes = { flow: EditingEdgeBody } as const;
