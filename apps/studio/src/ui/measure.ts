import { useEffectEvent, useLayoutEffect, type RefObject } from 'react';

/** Whether {@link useMeasured} watches the parent too and hands it over. */
export type MeasureOptions = {
  readonly alsoParent?: boolean;
};

/**
 * Reads an element at layout time and again on every resize of it, and puts
 * the reading away once the element goes. Layout time rather than effect time,
 * so nothing paints against a measurement the element has already left behind.
 *
 * `alsoParent` watches the element's parent as well and hands it over, for a
 * reading that is a relation between the two rather than the element alone: a
 * reading like that needs a parent, so without one nothing is read.
 *
 * The effect does not restart when either callback changes identity, and
 * every call reaches the latest one, so a caller need not hold either stable
 * across renders.
 */
export function useMeasured<T extends Element>(
  target: RefObject<T | null>,
  read: (node: T, parent: Element | null) => void,
  clear: () => void,
  { alsoParent = false }: MeasureOptions = {},
): void {
  const onRead = useEffectEvent(read);
  const onClear = useEffectEvent(clear);

  useLayoutEffect(() => {
    const node = target.current;
    const parent = node?.parentElement ?? null;
    if (node === null || (alsoParent && parent === null)) {
      return undefined;
    }
    const measure = (): void => {
      onRead(node, parent);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (alsoParent && parent !== null) {
      observer.observe(parent);
    }
    return () => {
      observer.disconnect();
      onClear();
    };
  }, [alsoParent, target]);
}
