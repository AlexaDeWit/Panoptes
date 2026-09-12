import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useMeasured } from './measure.js';

type Watcher = { readonly watched: Element[]; readonly resize: () => void };

const noResize = (): void => {};

const watching = (): Watcher => {
  const watched: Element[] = [];
  let announce = noResize;
  class Spy {
    constructor(run: () => void) {
      announce = run;
    }
    observe(element: Element): void {
      watched.push(element);
    }
    unobserve(): void {}
    disconnect(): void {
      watched.length = 0;
    }
  }
  vi.stubGlobal('ResizeObserver', Spy);
  return {
    watched,
    resize: () => {
      announce();
    },
  };
};

const mounted = (): { node: HTMLElement; parent: HTMLElement } => {
  const parent = document.createElement('div');
  const node = document.createElement('div');
  parent.append(node);
  document.body.append(parent);
  return { node, parent };
};

describe('useMeasured', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('reads on mount, again on a resize, and puts the reading away', () => {
    const watcher = watching();
    const { node } = mounted();
    const ref = createRef<HTMLElement>();
    ref.current = node;
    const readings: Element[] = [];
    let cleared = 0;

    const view = renderHook(() => {
      useMeasured(
        ref,
        (measured) => {
          readings.push(measured);
        },
        () => {
          cleared += 1;
        },
      );
    });

    expect(readings).toEqual([node]);
    expect(watcher.watched).toEqual([node]);

    watcher.resize();
    expect(readings).toEqual([node, node]);

    view.unmount();
    expect(cleared).toBe(1);
  });

  it('watches the parent and hands it over only when asked to', () => {
    const watcher = watching();
    const { node, parent } = mounted();
    const ref = createRef<HTMLElement>();
    ref.current = node;
    const beside: (Element | null)[] = [];

    renderHook(() => {
      useMeasured(
        ref,
        (unused, against) => {
          beside.push(against);
        },
        () => {},
        true,
      );
    });

    expect(beside).toEqual([parent]);
    expect(watcher.watched).toEqual([node, parent]);
  });

  it('reads nothing where there is no element to read', () => {
    const watcher = watching();
    const ref = createRef<HTMLElement>();
    let reads = 0;

    renderHook(() => {
      useMeasured(
        ref,
        () => {
          reads += 1;
        },
        () => {},
      );
    });

    expect(reads).toBe(0);
    expect(watcher.watched).toEqual([]);
  });
});
