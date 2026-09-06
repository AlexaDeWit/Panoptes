import type { ElementId, Threat, ThreatId } from '@saerskriven/model';
import { Accordion } from 'radix-ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import { keyboardOwner } from '../commands/binding.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { LiveRegion } from '../ui/live-region.js';
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

/**
 * A refused draft with the threat it was typed on. The overlay keeps one per
 * element, so a panel closed and opened again on the same element still holds
 * the text where it was being corrected.
 */
export type HeldDraft = RefusedField & { readonly threatId: ThreatId };

/**
 * What the panel shows, the drafts it hands back and forth, and the two
 * things the overlay above it decides: whether focus is being sent in, and
 * what closing does. `drafts` is the overlay's own map rather than a copy of
 * it, because a draft has to outlive the panel, which is unmounted the moment
 * another element is selected.
 */
export type ThreatPanelProps = {
  readonly subject: PanelSubject;
  readonly drafts: Map<ElementId, HeldDraft>;
  readonly focusing: boolean;
  readonly onFocused: () => void;
  readonly onClose: () => void;
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

/**
 * The threats of the selected element, each expandable to edit in place. It
 * is bound to the store's selection and to nothing else: the canvas selects,
 * the panel follows, and an edit here leaves as a store action, which is what
 * puts it on the canvas badges and under the same undo as every other edit.
 * With more than one element selected it says how many and offers no field,
 * there being no one element to record a threat against.
 *
 * Focus is moved on the two changes that take a control off the screen or put
 * one there: an added threat opens with focus in its title, and a deleted one
 * hands focus to the threat that took its place, or to the add control when
 * it was the last. Selection alone never moves focus here, which is what
 * `focusing` is for: it is set by a person asking for the panel and by
 * nothing else, and the add control is where they land. Both changes are
 * announced in the panel's live region as well, since a moved focus alone
 * tells a screen reader that something happened but not what it was. An add
 * is announced only once the store holds the threat, the reducer being free
 * to refuse an operation and leave the model where it was.
 *
 * Escape closes the panel, unless a listbox open inside it is holding the
 * key. The press is claimed, so the studio's own Escape, which clears the
 * selection, is not run by the same press ([the
 * commands](../commands/README.md)). It is read on the way in rather than on
 * the way out, so who owns the press is this one decision over what has
 * focus, rather than a race with whichever control did or did not answer the
 * press first.
 *
 * A text field the model refused announces there too, and the threat holding
 * the refused draft stays expanded until the text is fixed or cleared: Radix
 * unmounts a collapsed item's fields, which would take the draft with them.
 * The draft is kept in the overlay's map while the element it was typed on
 * stands, so closing the panel, or selecting elsewhere and coming back, puts
 * it back in the field it was typed in. What drops it is the text being
 * settled, by a correction or by an edit landing under it, or the threat it
 * was about leaving the element.
 */
export function ThreatPanel({
  subject,
  drafts,
  focusing,
  onFocused,
  onClose,
}: ThreatPanelProps) {
  const element = subject.kind === 'element' ? subject.element : undefined;
  const threats = useModelStore(useShallow(attachedThreats));
  const number = useModelStore(nextNumber);
  const opened = element === undefined ? undefined : drafts.get(element.id);
  const [expanded, setExpanded] = useState<string>(opened?.threatId ?? '');
  const [focus, setFocus] = useState<PanelFocus | undefined>(undefined);
  const [announced, setAnnounced] = useState('');
  const [draft, setDraft] = useState<HeldDraft | undefined>(opened);
  const addControl = useRef<HTMLButtonElement>(null);
  const held = threats.some((threat) => threat.id === draft?.threatId)
    ? draft
    : undefined;
  const said = held?.said ?? announced;
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
    setAnnounced(`Threat ${String(threat.number)} added.`);
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
    setAnnounced(`Threat ${String(threat.number)} deleted.`);
  };

  const refused =
    (threat: Threat) =>
    (refusal: RefusedField | undefined): void => {
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
      if (refusal !== undefined) {
        setAnnounced('');
      }
    };

  const expand = (value: string): void => {
    if (held === undefined || value === held.threatId) {
      setExpanded(value);
    }
  };

  const closing = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape' || keyboardOwner(event.target) === 'overlay') {
      return;
    }
    event.preventDefault();
    onClose();
  };

  return (
    <section
      aria-label="Threats"
      className={styles.panel}
      data-testid="threat-panel"
      onKeyDownCapture={closing}
    >
      <h2 className={styles.heading}>
        {element === undefined
          ? 'Threats'
          : `Threats on ${elementLabel(element)}`}
      </h2>
      {subject.kind === 'several' ? (
        <p className={styles.instruction}>
          {subject.count} elements selected. Select one of them to record a
          threat against it.
        </p>
      ) : (
        <>
          <LiveRegion
            className={styles.announcement}
            label="Panel messages"
            testId="threat-announcement"
          >
            {said !== '' && <p className={styles.message}>{said}</p>}
          </LiveRegion>
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
                  focus={focusIn(focus, threat)}
                  held={held?.threatId === threat.id ? held : undefined}
                  key={threat.id}
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
    </section>
  );
}
