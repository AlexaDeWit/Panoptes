import type { Threat } from '@panoptes/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from 'radix-ui';
import { sampleThreat } from '../store/store.fixtures.js';
import { ThreatEditor, type ThreatEditorProps } from './threat-editor.js';

const noop = (): void => undefined;

const commits = () => vi.fn<(patch: Partial<Threat>) => void>();

const showEditor = (
  overrides: Partial<ThreatEditorProps> = {},
  expanded = true,
): void => {
  const props: ThreatEditorProps = {
    threat: sampleThreat,
    focus: undefined,
    onCommit: noop,
    onDelete: noop,
    onFocused: noop,
    ...overrides,
  };
  render(
    <Accordion.Root
      collapsible
      defaultValue={expanded ? sampleThreat.id : ''}
      type="single"
    >
      <ThreatEditor {...props} />
    </Accordion.Root>,
  );
};

const disclosure = (): HTMLElement =>
  screen.getByRole('button', { name: /A reader edits/u });

describe('ThreatEditor', () => {
  it('is named by its number and title while it is collapsed', () => {
    showEditor({}, false);

    expect(disclosure().textContent).toContain('1');
    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
  });

  it('shows every field of the threat once it is expanded', () => {
    showEditor();

    for (const name of ['Title', 'Description', 'Mitigation']) {
      expect(screen.getByRole('textbox', { name })).toBeDefined();
    }
    for (const name of ['Category', 'Severity', 'Status']) {
      expect(screen.getByRole('combobox', { name })).toBeDefined();
    }
    expect(
      screen.getByRole('button', { name: 'Delete threat 1' }),
    ).toBeDefined();
  });

  it('commits a title left behind as a patch of that field alone', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    showEditor({ onCommit });

    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await user.keyboard('A reader edits a model{Enter}');

    expect(onCommit).toHaveBeenCalledWith({ title: 'A reader edits a model' });
  });

  it('commits a severity chosen as a patch of that field alone', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    showEditor({ onCommit });

    await user.click(screen.getByRole('combobox', { name: 'Severity' }));
    await user.click(screen.getByRole('option', { name: 'critical' }));

    expect(onCommit).toHaveBeenCalledWith({ severity: 'critical' });
  });

  it('takes the focus the panel sends into the title, and reports it', () => {
    const onFocused = vi.fn<() => void>();
    showEditor({ focus: 'title', onFocused });

    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Title' }),
    );
    expect(onFocused).toHaveBeenCalledTimes(1);
  });

  it('takes the focus the panel sends onto the control that expands it', () => {
    showEditor({ focus: 'disclosure' }, false);

    expect(document.activeElement).toBe(disclosure());
  });
});
