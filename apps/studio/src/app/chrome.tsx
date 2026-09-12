import { useLayoutEffect, useRef, type RefObject } from 'react';
import { CanvasMessages, Toolbox } from '../canvas/toolbox.js';
import {
  FileReports,
  StudioMenu,
  type StudioMenuProps,
} from '../files/menu.js';
import styles from './chrome.module.css';

const cardHeight = '--pn-chrome-block-size';

function useCardHeight(): RefObject<HTMLDivElement | null> {
  const card = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = card.current;
    if (node === null) {
      return undefined;
    }
    const root = document.documentElement;
    const measure = (): void => {
      root.style.setProperty(
        cardHeight,
        `${String(node.getBoundingClientRect().height)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty(cardHeight);
    };
  }, []);

  return card;
}

/**
 * The one floating card of shell chrome: the menu button and the diagram
 * control on row one, the tool modes on row two, and the failure notice, the
 * file reports, the canvas announcement and the flow chooser hanging under it.
 * The card's height goes back to the document root as `--pn-chrome-block-size`
 * for the controls that start below it, measured rather than counted from the
 * rows: the tools row wraps on a narrow enough viewport, and a constant would
 * then be short by a line.
 */
export function StudioChrome({
  colourMode,
  onColourModeChange,
  session,
  triggerRef,
}: StudioMenuProps) {
  const card = useCardHeight();

  return (
    <div className={styles.chrome}>
      <div className={styles.card} data-testid="chrome-card" ref={card}>
        <StudioMenu
          colourMode={colourMode}
          onColourModeChange={onColourModeChange}
          session={session}
          triggerRef={triggerRef}
        />
        <Toolbox />
      </div>
      <div className={styles.below}>
        <FileReports session={session} />
        <CanvasMessages />
      </div>
    </div>
  );
}
