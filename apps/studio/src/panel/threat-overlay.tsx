import type { ElementId } from '@panoptes/model';
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { focusElement } from '../canvas/edits.js';
import { useModelStore } from '../store/store.js';
import { panelFocusHandler } from './panel-focus.js';
import { ThreatPanel, type HeldDraft } from './threat-panel.js';
import { panelSubject, type PanelSubject } from './threats.js';

/**
 * Where the threat panel is on the page, and whether it is there at all. It
 * mounts inside the canvas container, over the right edge of the diagram, and
 * only while something is selected: with nothing selected there is no panel,
 * so the diagram has the whole of the canvas and the panel is the one place a
 * threat is added from.
 *
 * The panel never takes focus because it appeared. Enter on the selected
 * element asks for it ([the canvas](../canvas/README.md)), through the
 * channel beside this file, and lands on the panel's first control. Escape
 * inside the panel closes it and puts focus back on the element, which leaves
 * the element selected, so a second Escape is the studio's own and clears the
 * selection. What is closed is the subject the selector last answered with
 * rather than an element id: a selection that moves away and comes back is a
 * subject of its own, so it opens again, and so does asking for the panel
 * with Enter.
 *
 * The drafts the model refused are held here rather than in the panel,
 * because the panel is unmounted by every one of those moves and a draft has
 * to survive them. They are keyed by element and the panel keeps its own key
 * in step, so what comes back is what was typed on that element.
 */
export function ThreatOverlay() {
  const subject = useModelStore(useShallow(panelSubject));
  const [drafts] = useState(() => new Map<ElementId, HeldDraft>());
  const [closed, setClosed] = useState<PanelSubject | undefined>(undefined);
  const [focusing, setFocusing] = useState(false);
  const selected = subject?.kind === 'element' ? subject.element.id : undefined;

  const take = useCallback((): boolean => {
    if (subject?.kind !== 'element') {
      return false;
    }
    setClosed(undefined);
    setFocusing(true);
    return true;
  }, [subject]);

  const focused = useCallback(() => {
    setFocusing(false);
  }, []);

  const close = useCallback(() => {
    if (subject === undefined || selected === undefined) {
      return;
    }
    setClosed(subject);
    focusElement(selected);
  }, [selected, subject]);

  useEffect(() => panelFocusHandler(take), [take]);

  if (subject === undefined || subject === closed) {
    return null;
  }

  return (
    <ThreatPanel
      drafts={drafts}
      focusing={focusing}
      key={selected ?? 'several'}
      onClose={close}
      onFocused={focused}
      subject={subject}
    />
  );
}
