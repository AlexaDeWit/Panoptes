import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProseField, TextField, refusedText } from './text-field.js';

const softHyphen = '­';

const commits = () => vi.fn<(text: string) => void>();

const refusals = () => vi.fn<(refusal: string | undefined) => void>();

const noop = (): void => undefined;

const textbox = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

describe('refusedText', () => {
  it('accepts text of the character set the model defines', () => {
    expect(refusedText('Title', 'Threats, écluse, 脅威')).toBeUndefined();
  });

  it('names the field and where the first character the model refuses sits', () => {
    expect(refusedText('Title', `ab${softHyphen}c`)).toBe(
      'Title was not saved: character 3 is one the model does not accept.',
    );
  });

  it('counts characters rather than the code units the model reports', () => {
    expect(refusedText('Title', `😀ab${softHyphen}`)).toContain('character 4');
  });
});

describe('TextField', () => {
  it('commits what it holds when it is left, and not before', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <TextField label="Title" onCommit={onCommit} onRefused={noop} value="" />,
    );

    await user.click(textbox('Title'));
    await user.keyboard('A reader edits');
    expect(onCommit).toHaveBeenCalledTimes(0);

    await user.tab();

    expect(onCommit).toHaveBeenCalledWith('A reader edits');
  });

  it('commits on Enter, keeping the focus it had', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <TextField label="Title" onCommit={onCommit} onRefused={noop} value="" />,
    );

    await user.click(textbox('Title'));
    await user.keyboard('Retitled{Enter}');

    expect(onCommit).toHaveBeenCalledWith('Retitled');
    expect(document.activeElement).toBe(textbox('Title'));
  });

  it('refuses text carrying a character the model does not accept, and reports it', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    const onRefused = refusals();
    render(
      <TextField
        label="Title"
        onCommit={onCommit}
        onRefused={onRefused}
        value=""
      />,
    );

    await user.click(textbox('Title'));
    await user.keyboard(`ab${softHyphen}c{Enter}`);

    expect(onCommit).toHaveBeenCalledTimes(0);
    expect(onRefused).toHaveBeenCalledWith(
      'Title was not saved: character 3 is one the model does not accept.',
    );
    expect(textbox('Title').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/character 3/u)).toBeDefined();
  });

  it('reports a commit the model took as no refusal at all', async () => {
    const user = userEvent.setup();
    const onRefused = refusals();
    render(
      <TextField
        label="Title"
        onCommit={commits()}
        onRefused={onRefused}
        value=""
      />,
    );

    await user.click(textbox('Title'));
    await user.keyboard('Plain text{Enter}');

    expect(onRefused).toHaveBeenCalledWith(undefined);
  });

  it('takes the value an edit landing from elsewhere left behind', () => {
    const { rerender } = render(
      <TextField
        label="Title"
        onCommit={commits()}
        onRefused={noop}
        value="before"
      />,
    );

    rerender(
      <TextField
        label="Title"
        onCommit={commits()}
        onRefused={noop}
        value="after"
      />,
    );

    expect(screen.getByDisplayValue('after')).toBeDefined();
  });
});

describe('ProseField', () => {
  it('keeps Enter in the prose and commits when it is left', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <ProseField
        label="Description"
        onCommit={onCommit}
        onRefused={noop}
        value=""
      />,
    );

    await user.click(textbox('Description'));
    await user.keyboard('one{Enter}two');
    expect(onCommit).toHaveBeenCalledTimes(0);

    await user.tab();

    expect(onCommit).toHaveBeenCalledWith('one\ntwo');
  });
});
