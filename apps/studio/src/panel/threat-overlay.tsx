import type { ElementPropertyDrafts } from './element-properties.js';
import type { ElementId } from '@saerskriven/model';
import { memo, useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { focusElement } from '../canvas/edits.js';
import { selectedElements } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import { panelFocusHandler } from './panel-focus.js';
import { ThreatPanel, type HeldDraft } from './threat-panel.js';
import { openFileName, panelSubject } from './threats.js';

type Held = {
  readonly file: string | undefined;
  readonly drafts: Map<ElementId, HeldDraft>;
  readonly propertyDrafts: ElementPropertyDrafts;
};

/** Retains drafts and pane width across selections. Canvas-only parent renders do not rerender the pane. */
export const ThreatOverlay = memo(function ThreatOverlay({
  onCover,
}: {
  readonly onCover?: (cover: number) => void;
}) {
  const subject = useModelStore(useShallow(panelSubject));
  const file = useModelStore(openFileName);
  const [held, setHeld] = useState<Held>(() => ({
    file,
    drafts: new Map<ElementId, HeldDraft>(),
    propertyDrafts: new Map(),
  }));
  const selection = useModelStore(selectedElements);
  const selectionKey = selection.join(':');
  const [closed, setClosed] = useState<string | undefined>(undefined);
  const [wide, setWide] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const selected = subject?.kind === 'element' ? subject.element.id : undefined;

  if (closed !== undefined && closed !== selectionKey) {
    setClosed(undefined);
  }

  if (held.file !== file) {
    setHeld({ file, drafts: new Map(), propertyDrafts: new Map() });
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
    setClosed(selectionKey);
    const target = selection[0];
    if (target !== undefined) {
      focusElement(target);
    }
  }, [selection, selectionKey]);

  useEffect(() => panelFocusHandler(take), [take]);

  if (
    subject === undefined ||
    (closed !== undefined && closed === selectionKey)
  ) {
    return null;
  }

  return (
    <ThreatPanel
      drafts={held.drafts}
      propertyDrafts={held.propertyDrafts}
      focusing={focusing}
      key={selected ?? 'several'}
      onClose={close}
      onCover={onCover}
      wide={wide}
      onToggleWidth={() => {
        setWide((value) => !value);
      }}
      onFocused={focused}
      subject={subject}
    />
  );
});
