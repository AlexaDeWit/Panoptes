import {
  CanvasEdgeBody,
  CanvasFreeEndBody,
  CanvasNodeBody,
  canvasType,
  freeEndNodeKind,
  lineHeight,
  lineHeightRatio,
  nodeTextPlacement,
  wrappedTextStyles,
  type CanvasFlowEdge,
  type CanvasFlowNode,
  type CanvasNodeKind,
  type TextPlacement,
  type WrappedTextStyle,
} from '@saerskriven/canvas';
import type { ElementId } from '@saerskriven/model';
import {
  EdgeLabelRenderer,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import {
  describeContextualShortcuts,
  pressesContextualShortcut,
} from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import type { State } from '../store/state.js';
import { useModelStore } from '../store/store.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import {
  refusedName,
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
  resizeNode,
  stopInlineEditing,
} from './edits.js';
import { edgeLabel, nodeLabel } from './names.js';
import styles from './rename-field.module.css';

type InlineFieldProps = {
  readonly elementId: ElementId;
  readonly label: string;
  readonly value: string;
  readonly textStyle: WrappedTextStyle;
  readonly multiline?: boolean;
  readonly onCommit: (elementId: ElementId, text: string) => void;
  readonly refuse?: (label: string, text: string) => TextRefusal | undefined;
};

/**
 * The height of a name field holding one line, which is what a newly placed
 * element has to be tall and wide enough for before its name opens in place:
 * one line of the label type, the field carrying no frame inside its box.
 */
export const nameFieldExtent = lineHeight(wrappedTextStyles.label.fontSize);

function withoutLineBreaks(text: string): string {
  return text.replace(/[\r\n]+/gu, '');
}

function placedAt(placement: TextPlacement): CSSProperties {
  const fontSize = wrappedTextStyles[placement.textStyle].fontSize;
  const top =
    placement.anchor === 'top'
      ? placement.at.y - lineHeight(fontSize) / 2
      : placement.at.y;
  return {
    left: `${String(placement.at.x)}px`,
    top: `${String(top)}px`,
    width: `${String(placement.width)}px`,
    transform:
      placement.anchor === 'top'
        ? 'translate(-50%, 0)'
        : 'translate(-50%, -50%)',
  };
}

function typeOf(textStyle: WrappedTextStyle): CSSProperties {
  return {
    fontFamily: canvasType.family,
    fontSize: `${String(wrappedTextStyles[textStyle].fontSize)}px`,
    lineHeight: lineHeightRatio,
  };
}

function InlineField({
  elementId,
  label,
  value,
  textStyle,
  multiline = false,
  onCommit,
  refuse = refusedText,
}: InlineFieldProps) {
  const refusalId = useId();
  const keyboardDescriptionId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
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
    field.current?.focus();
    field.current?.select();
  }, []);

  useLayoutEffect(() => {
    const element = field.current;
    if (element === null || multiline) {
      return;
    }
    element.style.height = '';
    if (element.scrollHeight > 0) {
      element.style.height = `${String(element.scrollHeight)}px`;
    }
  });

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

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const commitsName =
      !multiline &&
      pressesContextualShortcut('commit-name', event, hostPlatform);
    const commitsNote =
      multiline &&
      pressesContextualShortcut('commit-note', event, hostPlatform);
    if (commitsName || commitsNote) {
      event.preventDefault();
      commit(true);
    }
    if (pressesContextualShortcut('cancel-canvas-text', event, hostPlatform)) {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <>
      <VisuallyHidden id={keyboardDescriptionId}>
        {describeContextualShortcuts(
          [multiline ? 'commit-note' : 'commit-name', 'cancel-canvas-text'],
          hostPlatform,
        )}
      </VisuallyHidden>
      <textarea
        aria-describedby={
          draft.refusal === undefined
            ? keyboardDescriptionId
            : `${keyboardDescriptionId} ${refusalId}`
        }
        aria-invalid={draft.refusal !== undefined}
        aria-label={label}
        className={`${styles.field}${multiline ? ` ${styles.note}` : ''}`}
        onBlur={() => {
          if (!settled.current) {
            commit(false);
          }
        }}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          resetAnnouncements();
          draft.change(
            multiline
              ? event.target.value
              : withoutLineBreaks(event.target.value),
          );
        }}
        onKeyDown={keyDown}
        ref={field}
        rows={1}
        style={typeOf(textStyle)}
        value={draft.text}
      />
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
  const [resizing, setResizing] = useState(false);
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
  const placement = editing ? nodeTextPlacement(node) : undefined;

  return (
    <>
      <CanvasNodeBody
        {...props}
        controlsVisible={!editing}
        onResize={() => {
          setResizing(true);
        }}
        onResizeEnd={(box) => {
          setResizing(false);
          resizeNode(node, box);
        }}
        resizing={resizing}
        textVisible={!editing}
      />
      {editingName && placement !== undefined && (
        <div
          className={`${styles.overText} nodrag nopan`}
          style={placedAt(placement)}
        >
          <InlineField
            elementId={node.id}
            label={`Name of ${nodeLabel(node)}`}
            onCommit={commitRename}
            refuse={refusedName}
            textStyle={placement.textStyle}
            value={node.name}
          />
        </div>
      )}
      {editingNote && placement !== undefined && (
        <div className={`${styles.overNote} nodrag nopan`}>
          <InlineField
            elementId={node.id}
            label="Note text"
            multiline
            onCommit={commitNote}
            textStyle={placement.textStyle}
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
      <CanvasEdgeBody {...props} textVisible={!editing} />
      {editing && edge !== undefined && (
        <EdgeLabelRenderer>
          <div
            className={`${styles.overText} nodrag nopan`}
            style={placedAt(edge.label.name)}
          >
            <InlineField
              elementId={edge.id}
              label={`Name of ${edgeLabel(edge)}`}
              onCommit={commitRename}
              refuse={refusedName}
              textStyle={edge.label.name.textStyle}
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
 * Each node subscribes only to its own editor state, and a node or flow
 * whose editor is open draws no text of its own, the field standing where
 * that text was drawn.
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
