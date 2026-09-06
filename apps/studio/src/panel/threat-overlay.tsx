import type { ElementId } from '@saerskriven/model';
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { focusElement } from '../canvas/edits.js';
import { useModelStore } from '../store/store.js';
import { panelFocusHandler } from './panel-focus.js';
import { ThreatPanel, type HeldDraft } from './threat-panel.js';
import { openFileName, panelSubject } from './threats.js';

type Held = {
  readonly file: string | undefined;
  readonly drafts: Map<ElementId, HeldDraft>;
};

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
 * selection. What is closed is the element, not the panel: the element stays
 * closed while it is the selection, whatever is then moved, resized or undone
 * on it, and the selection moving is what opens the panel again, as does
 * asking for it with Enter.
 *
 * The drafts the model refused are held here rather than in the panel,
 * because the panel is unmounted by every one of those moves and a draft has
 * to survive them. They are keyed by element and the panel keeps its own key
 * in step, so what comes back is what was typed on that element. They belong
 * to the file they were typed in, which is the map they are held in: a file
 * closed, opened or saved under another name is a fresh map during the render
 * that reads it, so a model carrying the same ids does not arrive with a
 * draft from a sitting somebody ended.
 */
export function ThreatOverlay() {
  const subject = useModelStore(useShallow(panelSubject));
  const file = useModelStore(openFileName);
  const [held, setHeld] = useState<Held>(() => ({
    file,
    drafts: new Map<ElementId, HeldDraft>(),
  }));
  const [closed, setClosed] = useState<ElementId | undefined>(undefined);
  const [focusing, setFocusing] = useState(false);
  const selected = subject?.kind === 'element' ? subject.element.id : undefined;

  if (closed !== undefined && closed !== selected) {
    setClosed(undefined);
  }

  if (held.file !== file) {
    setHeld({ file, drafts: new Map() });
  }

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
    if (selected === undefined) {
      return;
    }
    setClosed(selected);
    focusElement(selected);
  }, [selected]);

  useEffect(() => panelFocusHandler(take), [take]);

  if (subject === undefined || (closed !== undefined && closed === selected)) {
    return null;
  }

  return (
    <ThreatPanel
      drafts={held.drafts}
      focusing={focusing}
      key={selected ?? 'several'}
      onClose={close}
      onFocused={focused}
      subject={subject}
    />
  );
}
