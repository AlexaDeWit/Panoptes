import type { Threat } from '@panoptes/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from 'radix-ui';
import { sampleThreat } from '../store/store.fixtures.js';
import { ThreatEditor, type ThreatEditorProps } from './threat-editor.js';

const softHyphen = '­';

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
    onRefusal: noop,
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

const textbox = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

const chooseFrom = async (field: string, option: string): Promise<void> => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(screen.getByRole('option', { name: option }));
};

const typeInto = async (field: string, text: string): Promise<void> => {
  const user = userEvent.setup();
  await user.click(textbox(field));
  await user.keyboard(text);
  await user.tab();
};

describe('ThreatEditor', () => {
  it('is named by its number and title while it is collapsed', () => {
    showEditor({}, false);

    expect(disclosure().textContent).toContain('1');
    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
  });

  it('shows every field of the threat once it is expanded', () => {
    showEditor();

    for (const name of ['Title', 'Description', 'Mitigation']) {
      expect(textbox(name)).toBeDefined();
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

    await user.clear(textbox('Title'));
    await user.keyboard('A reader edits a model{Enter}');

    expect(onCommit).toHaveBeenCalledWith({ title: 'A reader edits a model' });
  });

  it('commits a description left behind as a patch of that field alone', async () => {
    const onCommit = commits();
    showEditor({ onCommit });

    await typeInto(
      'Description',
      'The reader has a token they may only read with.',
    );

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      description: 'The reader has a token they may only read with.',
    });
  });

  it('commits a mitigation left behind as a patch of that field alone', async () => {
    const onCommit = commits();
    showEditor({ onCommit });

    await typeInto('Mitigation', 'Check the token on every write.');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      mitigation: 'Check the token on every write.',
    });
  });

  it('commits a severity chosen as a patch of that field alone', async () => {
    const onCommit = commits();
    showEditor({ onCommit });

    await chooseFrom('Severity', 'critical');

    expect(onCommit).toHaveBeenCalledWith({ severity: 'critical' });
  });

  it('commits a status chosen as a patch of that field alone', async () => {
    const onCommit = commits();
    showEditor({ onCommit });

    await chooseFrom('Status', 'mitigated');

    expect(onCommit).toHaveBeenCalledWith({ status: 'mitigated' });
  });

  it('commits a category chosen as a patch of that field alone', async () => {
    const onCommit = commits();
    showEditor({ onCommit });

    await chooseFrom('Category', 'STRIDE spoofing');

    expect(onCommit).toHaveBeenCalledWith({
      category: { methodology: 'STRIDE', category: 'spoofing' },
    });
  });

  it('reports a refused draft, and keeps reporting it while a clean field commits beside it', async () => {
    const onRefusal = vi.fn<(refusal: string | undefined) => void>();
    showEditor({ onRefusal });

    await typeInto('Description', `Pasted${softHyphen}prose`);
    expect(onRefusal).toHaveBeenLastCalledWith(
      'Description was not saved: character 7 is one the model does not accept.',
    );

    await typeInto('Mitigation', 'Check the token.');

    expect(onRefusal).toHaveBeenLastCalledWith(
      'Description was not saved: character 7 is one the model does not accept.',
    );
  });

  it('says that deleting a threat several elements name takes it off all of them', () => {
    showEditor({
      threat: {
        ...sampleThreat,
        elements: [...sampleThreat.elements, ...sampleThreat.elements],
      },
    });

    expect(screen.getByText(/names 2 elements/u)).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Delete threat 1' })
        .getAttribute('aria-describedby'),
    ).not.toBeNull();
  });

  it('takes the focus the panel sends into the title, and reports it', () => {
    const onFocused = vi.fn<() => void>();
    showEditor({ focus: 'title', onFocused });

    expect(document.activeElement).toBe(textbox('Title'));
    expect(onFocused).toHaveBeenCalledTimes(1);
  });

  it('takes the focus the panel sends onto the control that expands it', () => {
    showEditor({ focus: 'disclosure' }, false);

    expect(document.activeElement).toBe(disclosure());
  });
});
