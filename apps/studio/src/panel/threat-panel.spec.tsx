import type { ElementId } from '@panoptes/model';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  firstThreat,
  processElement,
  sampleElement,
  sampleModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { editorTimeout } from './panel.fixtures.js';
import {
  ThreatPanel,
  type HeldDraft,
  type ThreatPanelProps,
} from './threat-panel.js';

const softHyphen = '­';

const noop = (): void => undefined;

const showPanel = (
  selection: ElementId,
  overrides: Partial<ThreatPanelProps> = {},
): void => {
  dispatch(Action.Select({ elementId: selection }));
  render(
    <ThreatPanel
      drafts={new Map()}
      focusing={false}
      onClose={noop}
      onFocused={noop}
      subject={{ kind: 'element', element: sampleElement(selection) }}
      {...overrides}
    />,
  );
};

const addControl = (): HTMLElement =>
  screen.getByRole('button', { name: 'Add a threat' });

const announcement = (): string =>
  screen.getByTestId('threat-announcement').textContent ?? '';

const titleField = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'Title' });

const severityOf = (): string =>
  screen.getByRole('combobox', { name: 'Severity' }).textContent ?? '';

const threatsInStore = (): number =>
  modelStore.getState().present.threats.length;

const addThreat = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(addControl());
};

describe(
  'ThreatPanel',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(sampleModel), true);
    });

    it('says how many are selected where more than one is, and offers no edit', () => {
      render(
        <ThreatPanel
          drafts={new Map()}
          focusing={false}
          onClose={noop}
          onFocused={noop}
          subject={{ kind: 'several', count: 3 }}
        />,
      );

      expect(screen.getByText(/^3 elements selected/u)).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add a threat' })).toBeNull();
    });

    it('names the selected element and lists what is recorded against it', () => {
      showPanel(actorElement);

      expect(
        screen.getByRole('heading', { name: 'Threats on Reader' }),
      ).toBeDefined();
      expect(
        screen.getByRole('button', { name: /A reader edits/u }),
      ).toBeDefined();
    });

    it('lists nothing for an element no threat names, and still offers an add', () => {
      showPanel(processElement);

      expect(screen.getByText(/Nothing is recorded/u)).toBeDefined();
      expect(addControl()).toBeDefined();
    });

    it('adds a threat to the selected element, focused on its title and announced', async () => {
      const user = userEvent.setup();
      showPanel(processElement);

      await addThreat(user);

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(titleField());
      expect(announcement()).toContain('Threat 2 added.');
    });

    it('deletes a threat, moving focus to the one that takes its place', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await addThreat(user);

      await user.click(screen.getByRole('button', { name: 'Delete threat 2' }));

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /A reader edits/u }),
      );
      expect(announcement()).toContain('Threat 2 deleted.');
    });

    it('deletes the last threat of an element, moving focus to the add control', async () => {
      const user = userEvent.setup();
      showPanel(processElement);
      await addThreat(user);

      await user.click(screen.getByRole('button', { name: 'Delete threat 2' }));

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(addControl());
    });

    it('commits one undoable step per field left behind', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('combobox', { name: 'Severity' }));
      await user.click(screen.getByRole('option', { name: 'critical' }));
      expect(severityOf()).toContain('critical');

      act(() => {
        dispatch(Action.Undo());
      });

      expect(severityOf()).toContain('medium');
    });

    it('keeps a refused draft on screen where the threat would collapse, and says so', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(
        screen.getByDisplayValue(`Pasted${softHyphen}prose`),
      ).toBeDefined();
      expect(screen.getByText(/^Character 7/u)).toBeDefined();
      expect(announcement()).toContain('Description was not saved');
      expect(modelStore.getState().present.threats[0].description).toBe('');
    });

    it('hands a refused draft to the map it was given, keyed by the threat it was typed on', async () => {
      const user = userEvent.setup();
      const drafts = new Map<ElementId, HeldDraft>();
      showPanel(actorElement, { drafts });
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(drafts.get(actorElement)).toEqual({
        threatId: firstThreat,
        field: 'Description',
        text: `Pasted${softHyphen}prose`,
        said: 'Description was not saved. Character 7 is one the model does not accept.',
      });
    });

    it('opens on the draft it was given, expanded where it was being corrected', () => {
      const drafts = new Map<ElementId, HeldDraft>([
        [
          actorElement,
          {
            threatId: firstThreat,
            field: 'Description',
            text: `Pasted${softHyphen}prose`,
            said: 'Description was not saved. Character 7 is one the model does not accept.',
          },
        ],
      ]);
      showPanel(actorElement, { drafts });

      expect(
        screen.getByDisplayValue(`Pasted${softHyphen}prose`),
      ).toBeDefined();
      expect(announcement()).toContain('Description was not saved');
    });

    it('drops a refusal an undo settled, and lets the threat collapse again', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));
      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard('Prose the model takes');
      await user.tab();

      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(softHyphen);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));
      expect(announcement()).toContain('Description was not saved');

      act(() => {
        dispatch(Action.Undo());
      });

      expect(announcement()).toBe('');

      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
    });

    it('lets the threat collapse once the refused text is corrected', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));
      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.clear(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard('Pasted prose');
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
      expect(modelStore.getState().present.threats[0].description).toBe(
        'Pasted prose',
      );
    });

    it('moves focus to its first control when it is asked for, and not before', () => {
      const focused = vi.fn<() => void>();
      const props: ThreatPanelProps = {
        drafts: new Map(),
        focusing: false,
        onClose: noop,
        onFocused: focused,
        subject: { kind: 'element', element: sampleElement(processElement) },
      };
      dispatch(Action.Select({ elementId: processElement }));
      const { rerender } = render(<ThreatPanel {...props} />);
      expect(document.activeElement).toBe(document.body);

      rerender(<ThreatPanel {...props} focusing />);

      expect(document.activeElement).toBe(addControl());
      expect(focused).toHaveBeenCalled();
    });

    it('closes on Escape, and leaves an open listbox its own', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn<() => void>();
      showPanel(actorElement, { onClose });
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('combobox', { name: 'Severity' }));
      await user.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole('textbox', { name: 'Title' }));
      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  },
  editorTimeout,
);
