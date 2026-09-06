import type { ElementId } from '@panoptes/model';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import {
  boundaryElement,
  canvasModel,
  noteElement,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import {
  chooserOpened,
  commitFlowTarget,
  currentConnecting,
  resetConnecting,
  startFlow,
} from './connecting.js';

const opened = (selection?: ElementId): void => {
  modelStore.setState({ ...initialState(canvasModel), selection }, true);
  resetConnecting();
};

const elementCount = (): number =>
  modelStore.getState().present.diagrams[0].elements.length;

describe('startFlow', () => {
  it('opens the chooser on the selected element', () => {
    opened(readerElement);

    startFlow();

    expect(currentConnecting()).toEqual({
      open: true,
      from: readerElement,
    });
  });

  it('starts nothing from a selection no flow can run from', () => {
    for (const selection of [
      undefined,
      boundaryElement,
      noteElement,
      requestFlow,
    ]) {
      opened(selection);

      startFlow();

      expect(currentConnecting().open).toBe(false);
    }
  });
});

describe('commitFlowTarget', () => {
  it('draws the flow from the element the command started at', () => {
    opened(readerElement);
    startFlow();

    const drew = commitFlowTarget(studioElement);

    expect(drew).toBe(true);
    expect(elementCount()).toBe(7);
    expect(currentConnecting()).toEqual({ open: false, from: undefined });
  });

  it('leaves a choice made outside a flow to the Connect control', () => {
    opened(readerElement);
    chooserOpened(true);

    const drew = commitFlowTarget(studioElement);

    expect(drew).toBe(false);
    expect(elementCount()).toBe(6);
  });
});

describe('chooserOpened', () => {
  it('cancels a flow in progress when the chooser closes, drawing nothing', () => {
    opened(readerElement);
    startFlow();

    chooserOpened(false);

    expect(currentConnecting()).toEqual({ open: false, from: undefined });
    expect(elementCount()).toBe(6);
  });
});
