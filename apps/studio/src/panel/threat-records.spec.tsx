import type { Threat } from '@saerskriven/model';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from 'radix-ui';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  firstAssumption,
  firstMitigation,
  firstThreat,
  recordedModel,
  secondThreat,
} from '../store/store.fixtures.js';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { dispatch, modelStore } from '../store/store.js';
import { chooseFrom, editorTimeout } from './panel.fixtures.js';
import { ThreatEditor, type RefusedField } from './threat-editor.js';

const softHyphen = '­';

const noop = (): void => undefined;

const threatOf = (id: Threat['id']): Threat =>
  recordedModel.threats.find((threat) => threat.id === id) ??
  recordedModel.threats[0];

const showRecords = (
  threat: Threat,
  held?: RefusedField,
  onRefusal: (refused: RefusedField | undefined) => void = noop,
): void => {
  render(
    <Accordion.Root collapsible defaultValue={threat.id} type="single">
      <ThreatEditor
        attachments={[]}
        focus={undefined}
        held={held}
        onChange={noop}
        onCommit={noop}
        onDelete={noop}
        onFocused={noop}
        onRefusal={onRefusal}
        threat={threat}
      />
    </Accordion.Root>,
  );
};

const button = (name: string): HTMLElement =>
  screen.getByRole('button', { name });

const textbox = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

const present = () => modelStore.getState().present;

const undoable = () => modelStore.getState().past.length;

describe(
  'the records of a threat',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(recordedModel), true);
      resetAnnouncements();
    });

    it('opens an empty first row with focus in its first field, and leaves the model alone', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Add mitigation'));

      expect(document.activeElement).toBe(textbox('Mitigation 1 title'));
      expect(present()).toBe(recordedModel);
    });

    it('leaves no record and no undo entry when the empty row is left', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Add mitigation'));
      for (const _ of ['description', 'status', 'discard', 'add']) {
        await user.tab();
      }
      expect(document.activeElement).toBe(button('Add mitigation'));

      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
      expect(present()).toBe(recordedModel);
      expect(undoable()).toBe(0);
    });

    it('creates one proposed mitigation on the threat at the first commit, which one undo takes back and one redo returns', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Add mitigation'));
      await user.keyboard('Sign every share link');
      await user.tab();

      expect(present().mitigations).toHaveLength(2);
      expect(present().mitigations.at(-1)).toMatchObject({
        title: 'Sign every share link',
        status: 'proposed',
        threats: [secondThreat],
      });
      expect(document.activeElement).toBe(textbox('Mitigation 1 description'));
      expect(undoable()).toBe(1);

      act(() => {
        dispatch(Action.Undo());
      });
      expect(present()).toBe(recordedModel);
      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();

      act(() => {
        dispatch(Action.Redo());
      });
      expect(screen.getByDisplayValue('Sign every share link')).toBe(
        textbox('Mitigation 1 title'),
      );
    });

    it('creates a new assumption unconfirmed', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Add assumption'));
      await user.keyboard('Share links expire.');
      await user.tab();

      expect(present().assumptions.at(-1)).toMatchObject({
        prose: 'Share links expire.',
        status: 'unconfirmed',
        threats: [secondThreat],
      });
    });

    it('removes a record unlinked from its only threat, and one undo restores it with its link', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(firstThreat));

      await user.click(button('Unlink mitigation 1'));

      expect(present().mitigations).toEqual([]);
      expect(document.activeElement).toBe(button('Add mitigation'));
      expect(currentAnnouncement().message).toContain(
        recordedModel.mitigations[0].title,
      );
      act(() => {
        dispatch(Action.Undo());
      });
      expect(present().mitigations).toEqual(recordedModel.mitigations);
    });

    it('keeps a shared record on its other threats when it is unlinked here', async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(
          Action.LinkAssumption({
            assumptionId: firstAssumption,
            threatId: secondThreat,
          }),
        );
      });
      showRecords(threatOf(firstThreat));

      await user.click(button('Unlink assumption 1'));

      expect(present().assumptions).toMatchObject([
        { id: firstAssumption, threats: [secondThreat] },
      ]);
    });

    it('offers to link only records not on the threat, and names how many other threats hold a linked one', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(
        screen.getByRole('combobox', { name: 'Existing mitigation' }),
      );
      expect(
        screen.getAllByRole('option').map((option) => option.textContent),
      ).toEqual([expect.stringContaining('Read-only share links')]);
      await user.keyboard('{Escape}');
      await user.click(button('Link existing mitigation'));

      expect(present().mitigations).toMatchObject([
        { id: firstMitigation, threats: [firstThreat, secondThreat] },
      ]);
      expect(document.activeElement).toBe(textbox('Mitigation 1 title'));
      const described = button('Unlink mitigation 1').getAttribute(
        'aria-describedby',
      );
      expect(document.getElementById(described ?? '')?.textContent).toContain(
        '1',
      );
      expect(
        screen.queryByRole('combobox', { name: 'Existing mitigation' }),
      ).toBeNull();
    });

    it('changes a status in place as one undo step that moves no threat status', async () => {
      showRecords(threatOf(firstThreat));

      await chooseFrom('Mitigation 1 status', 'verified');

      expect(present().mitigations[0].status).toBe('verified');
      expect(present().threats).toBe(recordedModel.threats);
      expect(undoable()).toBe(1);
    });

    it('holds a refused draft in the empty row and keeps the row open', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showRecords(threatOf(secondThreat), undefined, onRefusal);

      await user.click(button('Add assumption'));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(button('Add mitigation'));

      expect(present()).toBe(recordedModel);
      expect(textbox('Assumption 1').getAttribute('aria-invalid')).toBe('true');
      const reported = onRefusal.mock.lastCall?.[0];
      expect(reported?.text).toBe(`Pasted${softHyphen}prose`);
      expect(reported?.field.startsWith('new-assumption/prose/')).toBe(true);
    });

    it('puts a held draft back in the empty row it was typed in', () => {
      showRecords(threatOf(secondThreat), {
        field: 'new-assumption/prose/assumption-drafted',
        text: `Pasted${softHyphen}prose`,
        said: 'A refusal',
      });

      expect(screen.getByDisplayValue(`Pasted${softHyphen}prose`)).toBe(
        textbox('Assumption 1'),
      );
      expect(present()).toBe(recordedModel);
    });

    it('drops a refusal whose row another edit took away', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showRecords(threatOf(firstThreat), undefined, onRefusal);

      await user.click(textbox('Mitigation 1 title'));
      await user.keyboard(`{End}${softHyphen}`);
      await user.tab();
      expect(onRefusal.mock.lastCall?.[0]).toBeDefined();

      act(() => {
        dispatch(
          Action.UnlinkMitigation({
            mitigationId: firstMitigation,
            threatId: firstThreat,
          }),
        );
      });

      expect(onRefusal).toHaveBeenLastCalledWith(undefined);
    });

    it('edits a mitigation title and description in place, each as one replace', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(firstThreat));

      await user.click(textbox('Mitigation 1 title'));
      await user.keyboard(' for readers');
      await user.tab();
      await user.keyboard('Links carry a scope.');
      await user.tab();

      expect(present().mitigations).toMatchObject([
        {
          id: firstMitigation,
          title: 'Read-only share links for readers',
          prose: 'Links carry a scope.',
          threats: [firstThreat],
        },
      ]);
      expect(undoable()).toBe(2);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(present().mitigations[0]).toMatchObject({
        title: 'Read-only share links for readers',
        prose: '',
      });
    });

    it('edits an assumption in place as one replace', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(firstThreat));

      await user.click(textbox('Assumption 1'));
      await user.keyboard('{End} Readers are too.');
      await user.tab();

      expect(present().assumptions).toMatchObject([
        {
          id: firstAssumption,
          prose: 'Every editor is signed in. Readers are too.',
        },
      ]);
      expect(undoable()).toBe(1);
    });

    it('links an existing assumption and changes its status in place', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Link existing assumption'));
      expect(present().assumptions[0].threats).toEqual([
        firstThreat,
        secondThreat,
      ]);

      await chooseFrom('Assumption 1 status', 'invalidated');

      expect(present().assumptions[0].status).toBe('invalidated');
      expect(present().threats).toBe(recordedModel.threats);
      expect(undoable()).toBe(2);
    });

    it('puts a held mitigation draft back in its empty row', () => {
      showRecords(threatOf(secondThreat), {
        field: 'new-mitigation/title/mitigation-drafted',
        text: `Pasted${softHyphen}title`,
        said: 'A refusal',
      });

      expect(screen.getByDisplayValue(`Pasted${softHyphen}title`)).toBe(
        textbox('Mitigation 1 title'),
      );
    });

    it('drops a held draft for a record no longer on the threat, rather than reopening it', () => {
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showRecords(
        threatOf(secondThreat),
        {
          field: 'mitigation/title/mitigation-culled',
          text: `Pasted${softHyphen}title`,
          said: 'A refusal',
        },
        onRefusal,
      );

      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
      expect(onRefusal).toHaveBeenLastCalledWith(undefined);
    });

    it('keeps focus in the group when an undo takes the focused row away', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Add mitigation'));
      await user.keyboard('Sign every share link');
      await user.tab();
      expect(document.activeElement).toBe(textbox('Mitigation 1 description'));

      act(() => {
        dispatch(Action.Undo());
      });

      expect(document.activeElement).toBe(button('Add mitigation'));
    });

    it('starts a record on the status chosen in its empty row, and Discard leaves nothing', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Add mitigation'));
      await chooseFrom('Mitigation 1 status', 'implemented');
      expect(present()).toBe(recordedModel);
      await user.click(button('Discard mitigation 1'));

      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
      expect(document.activeElement).toBe(button('Add mitigation'));
      expect(present()).toBe(recordedModel);

      await user.click(button('Add mitigation'));
      await chooseFrom('Mitigation 1 status', 'implemented');
      await user.click(textbox('Mitigation 1 title'));
      await user.keyboard('Sign every share link');
      await user.tab();

      expect(present().mitigations.at(-1)).toMatchObject({
        title: 'Sign every share link',
        status: 'implemented',
      });
      expect(undoable()).toBe(1);
    });

    it('discards typed text in a new row on a pointer press of Discard, with no record and no undo entry', async () => {
      const user = userEvent.setup();
      showRecords(threatOf(secondThreat));

      await user.click(button('Add mitigation'));
      await user.keyboard('Sign every share link');
      await user.click(button('Discard mitigation 1'));

      expect(present()).toBe(recordedModel);
      expect(undoable()).toBe(0);
      expect(document.activeElement).toBe(button('Add mitigation'));
    });

    it('holds the status picked in a new row with its refused draft, and restores both', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showRecords(threatOf(secondThreat), undefined, onRefusal);

      await user.click(button('Add assumption'));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.tab();
      await chooseFrom('Assumption 1 status', 'valid');

      const reported = onRefusal.mock.lastCall?.[0];
      expect(reported?.status).toBe('valid');
      cleanup();
      showRecords(threatOf(secondThreat), reported);

      expect(
        screen.getByRole('combobox', { name: 'Assumption 1 status' })
          .textContent,
      ).toContain('valid');
      expect(present()).toBe(recordedModel);
    });

    it('holds a picked status with every refused draft of a new row', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showRecords(threatOf(secondThreat), undefined, onRefusal);

      await user.click(button('Add mitigation'));
      await user.keyboard(`Pasted${softHyphen}title`);
      await user.tab();
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.tab();
      await chooseFrom('Mitigation 1 status', 'implemented');

      const reported = onRefusal.mock.lastCall?.[0];
      expect(reported?.field.startsWith('new-mitigation/title/')).toBe(true);
      expect(reported?.status).toBe('implemented');
      cleanup();
      showRecords(threatOf(secondThreat), reported);

      expect(
        screen.getByRole('combobox', { name: 'Mitigation 1 status' })
          .textContent,
      ).toContain('implemented');
    });
  },
  editorTimeout,
);
