import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProseField, TextField, refusedText } from './text-field.js';

const softHyphen = '­';

const commits = () => vi.fn<(text: string) => void>();

const textbox = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

describe('refusedText', () => {
  it('accepts text of the character set the model defines', () => {
    expect(refusedText('Threats, écluse, 脅威')).toBeUndefined();
  });

  it('says where the first character the model refuses sits', () => {
    expect(refusedText(`ab${softHyphen}c`)).toContain('Character 3');
  });
});

describe('TextField', () => {
  it('commits what it holds when it is left, and not before', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(<TextField label="Title" onCommit={onCommit} value="" />);

    await user.click(textbox('Title'));
    await user.keyboard('A reader edits');
    expect(onCommit).toHaveBeenCalledTimes(0);

    await user.tab();

    expect(onCommit).toHaveBeenCalledWith('A reader edits');
  });

  it('commits on Enter, keeping the focus it had', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(<TextField label="Title" onCommit={onCommit} value="" />);

    await user.click(textbox('Title'));
    await user.keyboard('Retitled{Enter}');

    expect(onCommit).toHaveBeenCalledWith('Retitled');
    expect(document.activeElement).toBe(textbox('Title'));
  });

  it('refuses text carrying a character the model does not accept', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(<TextField label="Title" onCommit={onCommit} value="" />);

    await user.click(textbox('Title'));
    await user.keyboard(`ab${softHyphen}c{Enter}`);

    expect(onCommit).toHaveBeenCalledTimes(0);
    expect(textbox('Title').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/Character 3/u)).toBeDefined();
  });

  it('takes the value an edit landing from elsewhere left behind', () => {
    const { rerender } = render(
      <TextField label="Title" onCommit={commits()} value="before" />,
    );

    rerender(<TextField label="Title" onCommit={commits()} value="after" />);

    expect(screen.getByDisplayValue('after')).toBeDefined();
  });
});

describe('ProseField', () => {
  it('keeps Enter in the prose and commits when it is left', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(<ProseField label="Description" onCommit={onCommit} value="" />);

    await user.click(textbox('Description'));
    await user.keyboard('one{Enter}two');
    expect(onCommit).toHaveBeenCalledTimes(0);

    await user.tab();

    expect(onCommit).toHaveBeenCalledWith('one\ntwo');
  });
});
