import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EnumField, enumCommitter } from './enum-field.js';

const options = ['first', 'second', 'third'] as const;

type Option = (typeof options)[number];

const noop = (): void => undefined;

const commits = () => vi.fn<(chosen: Option) => void>();

describe('enumCommitter', () => {
  it('commits a value the options name', () => {
    const onCommit = commits();

    enumCommitter(options, onCommit)('second');

    expect(onCommit).toHaveBeenCalledWith('second');
  });

  it('commits nothing for a value the options do not name', () => {
    const onCommit = commits();

    enumCommitter(options, onCommit)('fourth');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });
});

describe('EnumField', () => {
  it('names the trigger from its visible label, as a combobox', () => {
    render(
      <EnumField
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Rank' })).toBeDefined();
  });

  it('puts the trigger on the tab path', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
      />,
    );

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('combobox'));
  });

  it('offers every option it was given, named by its text', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    for (const option of options) {
      expect(screen.getByRole('option', { name: option })).toBeDefined();
    }
  });

  it('puts the options under the heading each was grouped under', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        groupOf={(chosen) => (chosen === 'first' ? 'Early' : 'Late')}
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Late' }).textContent).toContain(
      'second',
    );
  });

  it('commits the value chosen with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <EnumField
        label="Rank"
        onCommit={onCommit}
        options={options}
        value="first"
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('second');
  });

  it('commits nothing when the listbox is dismissed', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <EnumField
        label="Rank"
        onCommit={onCommit}
        options={options}
        value="first"
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Escape}');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });

  it('commits nothing when the value already set is chosen again', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <EnumField
        label="Rank"
        onCommit={onCommit}
        options={options}
        value="first"
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });
});
