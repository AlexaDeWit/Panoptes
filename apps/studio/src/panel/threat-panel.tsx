import type { ElementId, Threat, ThreatId } from '@panoptes/model';
import { Accordion } from 'radix-ui';
import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Action } from '../store/actions.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { LiveRegion } from '../ui/live-region.js';
import { ThreatEditor, type EditorFocus } from './threat-editor.js';
import styles from './threat-panel.module.css';
import {
  attachedThreats,
  elementLabel,
  freshThreat,
  nextNumber,
  panelElement,
  threatAfterDeleting,
  threatCommitter,
} from './threats.js';

type PanelFocus = { readonly kind: EditorFocus; readonly threatId: ThreatId };

type Announced = {
  readonly about: ElementId | undefined;
  readonly said: string;
};

type Refusal = { readonly threatId: ThreatId; readonly said: string };

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
 *
 * Focus is moved on the two changes that take a control off the screen or put
 * one there: an added threat opens with focus in its title, and a deleted one
 * hands focus to the threat that took its place, or to the add control when
 * it was the last. Both are announced in the panel's live region as well,
 * since a moved focus alone tells a screen reader that something happened but
 * not what it was. What was announced is dropped as soon as the selection
 * moves off the element it was about, so the region never says again what
 * happened on an element the panel has left. An add is announced only once
 * the store holds the threat, the reducer being free to refuse an operation
 * and leave the model where it was.
 *
 * A text field the model refused announces there too, and the threat holding
 * the refused draft stays expanded until the text is fixed or cleared: Radix
 * unmounts a collapsed item's fields, which would take the draft with them.
 */
export function ThreatPanel() {
  const element = useModelStore(panelElement);
  const threats = useModelStore(useShallow(attachedThreats));
  const number = useModelStore(nextNumber);
  const [expanded, setExpanded] = useState('');
  const [focus, setFocus] = useState<PanelFocus | undefined>(undefined);
  const [announced, setAnnounced] = useState<Announced>({
    about: undefined,
    said: '',
  });
  const [refusal, setRefusal] = useState<Refusal | undefined>(undefined);
  const addControl = useRef<HTMLButtonElement>(null);
  const selected = element?.id;
  const held = threats.some((threat) => threat.id === refusal?.threatId)
    ? refusal?.threatId
    : undefined;
  const said = refusal?.said ?? announced.said;
  const focused = useCallback(() => {
    setFocus(undefined);
  }, []);

  if (announced.about !== selected && announced.said !== '') {
    setAnnounced({ about: selected, said: '' });
  }

  const add = (): void => {
    if (element === undefined) {
      return;
    }
    const threat = freshThreat(number, element.id);
    dispatch(Action.AddThreat({ threat }));
    if (!modelStore.getState().present.threats.includes(threat)) {
      return;
    }
    setExpanded(threat.id);
    setRefusal(undefined);
    setFocus({ kind: 'title', threatId: threat.id });
    setAnnounced({
      about: element.id,
      said: `Threat ${String(threat.number)} added.`,
    });
  };

  const remove = (threat: Threat): void => {
    const next = threatAfterDeleting(threats, threat.id);
    dispatch(Action.RemoveThreat({ threatId: threat.id }));
    setRefusal(undefined);
    if (next === undefined) {
      addControl.current?.focus();
    } else {
      setFocus({ kind: 'disclosure', threatId: next });
    }
    setAnnounced({
      about: selected,
      said: `Threat ${String(threat.number)} deleted.`,
    });
  };

  const refused =
    (threat: Threat) =>
    (message: string | undefined): void => {
      setRefusal(
        message === undefined
          ? undefined
          : { threatId: threat.id, said: message },
      );
      if (message !== undefined) {
        setAnnounced({ about: selected, said: '' });
      }
    };

  const expand = (value: string): void => {
    if (held === undefined || value === held) {
      setExpanded(value);
    }
  };

  return (
    <section aria-label="Threats" className={styles.panel}>
      <h2 className={styles.heading}>
        {element === undefined
          ? 'Threats'
          : `Threats on ${elementLabel(element)}`}
      </h2>
      <LiveRegion
        className={styles.announcement}
        label="Panel messages"
        testId="threat-announcement"
      >
        {said !== '' && <p className={styles.message}>{said}</p>}
      </LiveRegion>
      {element === undefined ? (
        <p className={styles.instruction}>
          Select an element on the diagram to see the threats recorded against
          it.
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
                  focus={focusIn(focus, threat)}
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
