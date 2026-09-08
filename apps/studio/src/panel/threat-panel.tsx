import { Cross1Icon } from '@radix-ui/react-icons';
import type { ElementId, Threat, ThreatId } from '@saerskriven/model';
import { Accordion } from 'radix-ui';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { announce, resetAnnouncements } from '../canvas/announcements.js';
import { keyboardOwner } from '../commands/binding.js';
import {
  describeContextualShortcuts,
  pressesContextualShortcut,
} from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import {
  ThreatEditor,
  type EditorFocus,
  type RefusedField,
} from './threat-editor.js';
import styles from './threat-panel.module.css';
import {
  attachedThreats,
  elementLabel,
  freshThreat,
  nextNumber,
  threatAfterDeleting,
  threatCommitter,
  type PanelSubject,
} from './threats.js';

type PanelFocus = { readonly kind: EditorFocus; readonly threatId: ThreatId };

/** A refused draft retained by the overlay for one element. */
export type HeldDraft = RefusedField & { readonly threatId: ThreatId };

/** The selected subject, retained drafts, focus, and pane controls. */
export type ThreatPanelProps = {
  readonly subject: PanelSubject;
  readonly drafts: Map<ElementId, HeldDraft>;
  readonly focusing: boolean;
  readonly onFocused: () => void;
  readonly onClose: () => void;
  readonly wide: boolean;
  readonly onToggleWidth: () => void;
  readonly onCover?: (cover: number) => void;
};

function focusIn(
  focus: PanelFocus | undefined,
  threat: Threat,
): EditorFocus | undefined {
  if (focus === undefined || focus.threatId !== threat.id) {
    return undefined;
  }
  return focus.kind;
}

/** Edits the selected element in place. Listboxes retain ownership of Escape. */
export function ThreatPanel({
  subject,
  drafts,
  focusing,
  onFocused,
  onClose,
  wide,
  onToggleWidth,
  onCover,
}: ThreatPanelProps) {
  const element = subject.kind === 'element' ? subject.element : undefined;
  const threats = useModelStore(useShallow(attachedThreats));
  const number = useModelStore(nextNumber);
  const diagrams = useModelStore((state) => state.present.diagrams);
  const panel = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const node = panel.current;
    const parent = node?.parentElement;
    if (
      node === null ||
      parent === undefined ||
      parent === null ||
      onCover === undefined
    ) {
      return undefined;
    }
    const measure = (): void => {
      onCover(
        parent.getBoundingClientRect().right -
          node.getBoundingClientRect().left,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(parent);
    return () => {
      observer.disconnect();
      onCover(0);
    };
  }, [onCover]);
  const opened = element === undefined ? undefined : drafts.get(element.id);
  const [expanded, setExpanded] = useState<string>(opened?.threatId ?? '');
  const [focus, setFocus] = useState<PanelFocus | undefined>(undefined);
  const [draft, setDraft] = useState<HeldDraft | undefined>(opened);
  const addControl = useRef<HTMLButtonElement>(null);
  const keyboardDescriptionId = useId();
  const held = threats.some((threat) => threat.id === draft?.threatId)
    ? draft
    : undefined;
  const focused = useCallback(() => {
    setFocus(undefined);
  }, []);

  if (draft !== undefined && held === undefined) {
    setDraft(undefined);
  }

  useEffect(() => {
    if (element === undefined) {
      return;
    }
    if (draft === undefined) {
      drafts.delete(element.id);
    } else {
      drafts.set(element.id, draft);
    }
  }, [draft, drafts, element]);

  useEffect(() => {
    if (!focusing) {
      return;
    }
    addControl.current?.focus();
    onFocused();
  }, [focusing, onFocused]);

  const add = (): void => {
    if (element === undefined) {
      return;
    }
    const threat = freshThreat(number, element.id);
    dispatch(Action.AddThreat({ threat }));
    const added = modelStore
      .getState()
      .present.threats.some((candidate) => candidate.id === threat.id);
    if (!added) {
      return;
    }
    setExpanded(threat.id);
    setDraft(undefined);
    setFocus({ kind: 'title', threatId: threat.id });
  };

  const remove = (threat: Threat): void => {
    const next = threatAfterDeleting(threats, threat.id);
    dispatch(Action.RemoveThreat({ threatId: threat.id }));
    setDraft(undefined);
    if (next === undefined) {
      addControl.current?.focus();
    } else {
      setFocus({ kind: 'disclosure', threatId: next });
    }
    announce(`Threat ${String(threat.number)} deleted.`);
  };

  const refused =
    (threat: Threat) =>
    (refusal: RefusedField | undefined): void => {
      const alreadyHeld =
        refusal !== undefined &&
        draft?.threatId === threat.id &&
        draft.field === refusal.field &&
        draft.text === refusal.text;
      const next =
        refusal === undefined ? undefined : { threatId: threat.id, ...refusal };
      setDraft(next);
      if (element !== undefined) {
        if (next === undefined) {
          drafts.delete(element.id);
        } else {
          drafts.set(element.id, next);
        }
      }
      if (refusal !== undefined && !alreadyHeld) {
        announce(refusal.said);
      }
    };

  const expand = (value: string): void => {
    if (held === undefined || value === held.threatId) {
      if (value !== expanded) {
        resetAnnouncements();
      }
      setExpanded(value);
    }
  };

  const closing = (event: KeyboardEvent<HTMLElement>): void => {
    if (
      !pressesContextualShortcut('close-threat-panel', event, hostPlatform) ||
      keyboardOwner(event.target) === 'overlay'
    ) {
      return;
    }
    event.preventDefault();
    onClose();
  };

  return (
    <section
      aria-describedby={keyboardDescriptionId}
      aria-label="Threats"
      className={styles.panel}
      data-testid="threat-panel"
      data-wide={wide}
      ref={panel}
      onKeyDownCapture={closing}
    >
      <VisuallyHidden id={keyboardDescriptionId}>
        {describeContextualShortcuts(['close-threat-panel'], hostPlatform)}
      </VisuallyHidden>
      <header className={styles.panelHeader}>
        <h2 className={styles.heading}>
          {element === undefined
            ? 'Threats'
            : `Threats on ${elementLabel(element)}`}
        </h2>
        <div className={styles.controls}>
          <button
            className={styles.width}
            onClick={onToggleWidth}
            type="button"
          >
            {wide ? 'Restore pane width' : 'Widen pane'}
          </button>
          <button
            aria-label="Close threats"
            className={styles.close}
            onClick={onClose}
            type="button"
          >
            <Cross1Icon aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className={styles.body}>
        {subject.kind === 'several' ? (
          <p className={styles.instruction}>
            {subject.count} elements selected. Select one of them to record a
            threat against it.
          </p>
        ) : (
          <>
            <button
              className={styles.add}
              onClick={add}
              ref={addControl}
              type="button"
            >
              Add a threat
            </button>
            {threats.length === 0 ? (
              <p className={styles.instruction}>
                Nothing is recorded against this element yet.
              </p>
            ) : (
              <Accordion.Root
                className={styles.list}
                collapsible
                onValueChange={expand}
                type="single"
                value={expanded}
              >
                {threats.map((threat) => (
                  <ThreatEditor
                    attachments={diagrams
                      .flatMap((diagram) => diagram.elements)
                      .filter((candidate) =>
                        threat.elements.includes(candidate.id),
                      )}
                    focus={focusIn(focus, threat)}
                    held={held?.threatId === threat.id ? held : undefined}
                    key={threat.id}
                    onChange={resetAnnouncements}
                    onCommit={threatCommitter(dispatch, threat)}
                    onDelete={() => {
                      remove(threat);
                    }}
                    onFocused={focused}
                    onRefusal={refused(threat)}
                    threat={threat}
                  />
                ))}
              </Accordion.Root>
            )}
          </>
        )}
      </div>
    </section>
  );
}
