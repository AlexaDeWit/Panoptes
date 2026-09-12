import {
  elementId,
  parsedFixture,
  validModelFixture,
} from '@saerskriven/model/fixtures';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  ElementPropertiesEditor,
  type ElementPropertyDrafts,
} from './element-properties.js';
import { chooseFrom } from './panel.fixtures.js';

const base = parsedFixture(validModelFixture);
const flagCases = [
  ['element-customer', 'Provides authentication', 'providesAuthentication'],
  ['element-api', 'Handles card payments', 'handlesCardPayment'],
  ['element-api', 'Handles goods or services', 'handlesGoodsOrServices'],
  ['element-api', 'Web application', 'isWebApplication'],
  ['element-db', 'Log store', 'isALog'],
  ['element-db', 'Encrypted storage', 'isEncrypted'],
  ['element-db', 'Signed storage', 'isSigned'],
  ['element-db', 'Stores credentials', 'storesCredentials'],
  ['element-db', 'Stores inventory', 'storesInventory'],
  ['element-order-flow', 'Encrypted flow', 'isEncrypted'],
  ['element-order-flow', 'Public network', 'isPublicNetwork'],
];
const current = (id: string) =>
  modelStore
    .getState()
    .present.diagrams[0].elements.find((element) => element.id === id);

async function open(id: string, drafts?: ElementPropertyDrafts) {
  const shown = render(
    <ElementPropertiesEditor elementId={elementId(id)} drafts={drafts} />,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Security properties' }),
  );
  return shown;
}

beforeEach(() => {
  modelStore.setState(initialState(base), true);
});

describe('element security controls', () => {
  it.each(flagCases)(
    'views, sets, changes and clears %s %s with undo and redo',
    async (id, label, field) => {
      await open(id);
      expect(
        screen.getByRole('combobox', { name: label }).textContent,
      ).toContain('Not recorded');
      await chooseFrom(label, 'Yes');
      expect(current(id)).toHaveProperty(field, true);
      await chooseFrom(label, 'No');
      expect(current(id)).toHaveProperty(field, false);
      await chooseFrom(label, 'Not recorded');
      expect(current(id)).not.toHaveProperty(field);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(screen.getByRole('combobox', { name: label }).textContent).toMatch(
        /^No\b/u,
      );
      act(() => {
        dispatch(Action.Redo());
      });
      expect(
        screen.getByRole('combobox', { name: label }).textContent,
      ).toContain('Not recorded');
      expect(modelStore.getState().past).toHaveLength(3);
    },
  );

  it.each([
    ['element-api', 'Privilege level', 'privilegeLevel'],
    ['element-order-flow', 'Protocol', 'protocol'],
  ])(
    'distinguishes absent, empty and populated %s %s text',
    async (id, label, field) => {
      const user = userEvent.setup();
      await open(id);
      expect(screen.queryByRole('textbox', { name: label })).toBeNull();
      await chooseFrom(`${label} recording`, 'Recorded');
      expect(current(id)).toHaveProperty(field, '');
      await user.type(
        screen.getByRole('textbox', { name: label }),
        'custom value{Enter}',
      );
      expect(current(id)).toHaveProperty(field, 'custom value');
      await user.tab();
      expect(modelStore.getState().past).toHaveLength(2);
      await chooseFrom(`${label} recording`, 'Not recorded');
      expect(current(id)).not.toHaveProperty(field);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(
        screen.getByRole('textbox', { name: label }).getAttribute('value'),
      ).toBe('custom value');
    },
  );

  it('retains refused text through closing and selection changes, and clears it when corrected', async () => {
    const drafts: ElementPropertyDrafts = new Map();
    const user = userEvent.setup();
    const shown = await open('element-api', drafts);
    await chooseFrom('Privilege level recording', 'Recorded');
    await user.type(
      screen.getByRole('textbox', { name: 'Privilege level' }),
      'bad\u00ad{Enter}',
    );
    expect(
      screen
        .getByRole('textbox', { name: 'Privilege level' })
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(current('element-api')).toHaveProperty('privilegeLevel', '');
    shown.unmount();
    const elsewhere = await open('element-db', drafts);
    elsewhere.unmount();
    render(
      <ElementPropertiesEditor
        elementId={elementId('element-api')}
        drafts={drafts}
      />,
    );
    expect(
      screen
        .getByRole('textbox', { name: 'Privilege level' })
        .getAttribute('value'),
    ).toBe('bad\u00ad');
    await user.clear(screen.getByRole('textbox', { name: 'Privilege level' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Privilege level' }),
      'user{Enter}',
    );
    expect(current('element-api')).toHaveProperty('privilegeLevel', 'user');
    expect(
      screen
        .getByRole('textbox', { name: 'Privilege level' })
        .getAttribute('aria-invalid'),
    ).toBe('false');
  });

  it.each([
    [
      'element-order-flow',
      'Crossed trust boundaries',
      'trustBoundaryIds',
      'Service perimeter',
      'Order API',
    ],
    [
      'element-perimeter',
      'Contained elements',
      'containedElements',
      'Order API',
      'Service perimeter',
    ],
    [
      'element-perimeter',
      'Crossing flows',
      'crossingFlows',
      'Submit order',
      'Order API',
    ],
  ])(
    'edits %s %s from valid targets and preserves recorded empty lists',
    async (id, label, field, allowed, excluded) => {
      const user = userEvent.setup();
      await open(id);
      await chooseFrom(`${label} recording`, 'Recorded');
      expect(current(id)).toHaveProperty(field, []);
      await user.click(
        screen.getByRole('combobox', { name: `Add to ${label.toLowerCase()}` }),
      );
      expect(screen.getByRole('option', { name: allowed })).toBeDefined();
      expect(screen.queryByRole('option', { name: excluded })).toBeNull();
      await user.click(screen.getByRole('option', { name: allowed }));
      const group = within(screen.getByRole('group', { name: label }));
      await user.click(group.getByRole('button', { name: 'Add relationship' }));
      expect(current(id)).toHaveProperty(field, [
        allowed === 'Order API'
          ? 'element-api'
          : allowed === 'Service perimeter'
            ? 'element-perimeter'
            : 'element-order-flow',
      ]);
      await user.click(group.getByRole('button', { name: 'Add relationship' }));
      expect(group.getAllByRole('button', { name: /^Remove/u })).toHaveLength(
        2,
      );
      await user.click(
        group.getByRole('button', { name: `Remove ${label.toLowerCase()} 1` }),
      );
      await user.click(
        group.getByRole('button', { name: `Remove ${label.toLowerCase()} 1` }),
      );
      expect(current(id)).toHaveProperty(field, []);
      await chooseFrom(`${label} recording`, 'Not recorded');
      expect(current(id)).not.toHaveProperty(field);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(current(id)).toHaveProperty(field, []);
    },
  );
  it('distinguishes same-named relationship targets by ID', async () => {
    const duplicate = {
      ...base.diagrams[0].elements[1],
      id: elementId('element-duplicate'),
    };
    modelStore.setState(
      initialState({
        ...base,
        diagrams: [
          {
            ...base.diagrams[0],
            elements: [...base.diagrams[0].elements, duplicate],
          },
        ],
      }),
      true,
    );
    const user = userEvent.setup();
    await open('element-perimeter');
    await chooseFrom('Contained elements recording', 'Recorded');
    await user.click(
      screen.getByRole('combobox', { name: 'Add to contained elements' }),
    );
    expect(
      screen.getByRole('option', { name: 'Order API (element-api)' }),
    ).toBeDefined();
    await user.click(
      screen.getByRole('option', { name: 'Order API (element-duplicate)' }),
    );
    await user.click(
      within(
        screen.getByRole('group', { name: 'Contained elements' }),
      ).getByRole('button', { name: 'Add relationship' }),
    );
    expect(current('element-perimeter')).toHaveProperty('containedElements', [
      'element-duplicate',
    ]);
  });
  it('keeps keyboard focus when a relationship changes and when its last row is removed', async () => {
    const user = userEvent.setup();
    await open('element-order-flow');
    await chooseFrom('Crossed trust boundaries recording', 'Recorded');
    await user.click(screen.getByRole('button', { name: 'Add relationship' }));
    await chooseFrom('Crossed trust boundaries 1', 'Billing zone');
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('combobox', { name: 'Crossed trust boundaries 1' }),
      );
    });
    screen
      .getByRole('button', { name: 'Remove crossed trust boundaries 1' })
      .focus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Add relationship' }),
      );
    });
    expect(current('element-order-flow')).toHaveProperty(
      'trustBoundaryIds',
      [],
    );
  });
});
