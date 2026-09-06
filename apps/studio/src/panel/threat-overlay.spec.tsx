import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  processElement,
  sampleModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { focusThreatPanel } from './panel-focus.js';
import { ThreatOverlay } from './threat-overlay.js';

const softHyphen = '­';

const panel = () => screen.queryByRole('region', { name: 'Threats' });

const addControl = (): HTMLElement =>
  screen.getByRole('button', { name: 'Add a threat' });

const description = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'Description' });

const select = (elementId = actorElement): void => {
  act(() => {
    dispatch(Action.Select({ elementId }));
  });
};

const refuseADraft = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: /A reader edits/u }));
  await user.click(description());
  await user.keyboard(`Pasted${softHyphen}prose`);
  await user.click(screen.getByRole('button', { name: /A reader edits/u }));
};

describe('ThreatOverlay', () => {
  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
  });

  it('draws no panel while nothing is selected, and one on the element selected', () => {
    render(<ThreatOverlay />);
    expect(panel()).toBeNull();

    select();

    expect(
      screen.getByRole('heading', { name: 'Threats on Reader' }),
    ).toBeDefined();
  });

  it('takes the panel away again when the selection clears', () => {
    render(<ThreatOverlay />);
    select();

    act(() => {
      dispatch(Action.Select({ elementId: undefined }));
    });

    expect(panel()).toBeNull();
  });

  it('leaves focus where it was when a panel opens', () => {
    render(<ThreatOverlay />);

    select();

    expect(document.activeElement).toBe(document.body);
  });

  it('moves focus in when it is asked for, and opens a panel Escape closed', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();

    act(() => {
      expect(focusThreatPanel()).toBe(true);
    });
    expect(document.activeElement).toBe(addControl());

    await user.keyboard('{Escape}');
    expect(panel()).toBeNull();
    expect(modelStore.getState().selection).toBe(actorElement);

    act(() => {
      expect(focusThreatPanel()).toBe(true);
    });

    expect(document.activeElement).toBe(addControl());
  });

  it('is asked for nothing while no panel is open', () => {
    render(<ThreatOverlay />);

    expect(focusThreatPanel()).toBe(false);
  });

  it('puts a refused draft back when its element is selected again', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await refuseADraft(user);
    expect(screen.getByDisplayValue(`Pasted${softHyphen}prose`)).toBeDefined();

    select(processElement);
    expect(screen.queryByDisplayValue(`Pasted${softHyphen}prose`)).toBeNull();
    select();

    expect(screen.getByDisplayValue(`Pasted${softHyphen}prose`)).toBeDefined();
    expect(description().getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps a refused draft through a panel Escape closed', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await refuseADraft(user);

    await user.keyboard('{Escape}');
    expect(panel()).toBeNull();
    act(() => {
      expect(focusThreatPanel()).toBe(true);
    });

    expect(screen.getByDisplayValue(`Pasted${softHyphen}prose`)).toBeDefined();
  });

  it('drops the draft the panel corrected, so the element opens on the model again', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await refuseADraft(user);

    await user.clear(description());
    await user.keyboard('Pasted prose');
    await user.click(screen.getByRole('button', { name: /A reader edits/u }));
    select(processElement);
    select();

    expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
    expect(modelStore.getState().present.threats[0].description).toBe(
      'Pasted prose',
    );
  });
});
