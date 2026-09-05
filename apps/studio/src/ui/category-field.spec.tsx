import { threatCategorySchema, type ThreatCategory } from '@panoptes/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  CategoryField,
  categoryCommitter,
  categoryKey,
  enumeratedCategoryKeys,
} from './category-field.js';

const stride: ThreatCategory = {
  methodology: 'STRIDE',
  category: 'tampering',
};

const custom: ThreatCategory = {
  methodology: 'custom',
  methodologyName: 'House rules',
  category: 'billing abuse',
};

const noop = (): void => undefined;

describe('categoryKey', () => {
  it('pairs an enumerated methodology with its category', () => {
    expect(categoryKey(stride)).toBe('STRIDE tampering');
  });

  it('keeps a custom methodology out of the enumerated keys', () => {
    expect(enumeratedCategoryKeys).not.toContain(categoryKey(custom));
  });
});

describe('enumeratedCategoryKeys', () => {
  it('offers every methodology the union enumerates', () => {
    const methodologies = new Set(
      enumeratedCategoryKeys.map((key) => key.split(' ')[0]),
    );

    expect(methodologies.size).toBe(threatCategorySchema.options.length - 1);
  });
});

describe('categoryCommitter', () => {
  it('commits the category a key names', () => {
    const onCommit = vi.fn<(category: ThreatCategory) => void>();

    categoryCommitter(onCommit)('LINDDUN linking');

    expect(onCommit).toHaveBeenCalledWith({
      methodology: 'LINDDUN',
      category: 'linking',
    });
  });

  it('commits nothing for a key no enumerated pair names', () => {
    const onCommit = vi.fn<(category: ThreatCategory) => void>();

    categoryCommitter(onCommit)(categoryKey(custom));

    expect(onCommit).toHaveBeenCalledTimes(0);
  });
});

describe('CategoryField', () => {
  it('names its trigger Category, as a combobox showing the pair', () => {
    render(<CategoryField onCommit={noop} value={stride} />);

    expect(
      screen.getByRole('combobox', { name: 'Category' }).textContent,
    ).toContain('STRIDE tampering');
  });

  it('offers every enumerated pair', async () => {
    const user = userEvent.setup();
    render(<CategoryField onCommit={noop} value={stride} />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('option')).toHaveLength(
      enumeratedCategoryKeys.length,
    );
  });

  it('shows a custom category the file carried, beside the enumerated pairs', async () => {
    const user = userEvent.setup();
    render(<CategoryField onCommit={noop} value={custom} />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(
      screen.getByRole('option', { name: 'custom House rules billing abuse' }),
    ).toBeDefined();
    expect(screen.getAllByRole('option')).toHaveLength(
      enumeratedCategoryKeys.length + 1,
    );
  });

  it('commits the pair chosen with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<(category: ThreatCategory) => void>();
    render(<CategoryField onCommit={onCommit} value={stride} />);

    await user.tab();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');

    expect(onCommit).toHaveBeenCalledWith({
      methodology: 'STRIDE',
      category: 'repudiation',
    });
  });
});
