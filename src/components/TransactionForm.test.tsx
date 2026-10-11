import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TransactionForm from './TransactionForm';
import { Group, Transaction } from '../types';

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  description: 'Dinner',
  amount: 30,
  date: new Date('2026-01-01'),
  category: 'Food & Dining',
  notes: '',
  payerId: '1',
  splitType: 'equal',
  splits: [
    { memberId: '1', amount: 15 },
    { memberId: '2', amount: 15 },
  ],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const makeGroup = (transactions: Transaction[] = []): Group => ({
  id: 'g1',
  name: 'Trip',
  userId: 'u1',
  memberUserIds: ['u1'],
  members: [
    { id: '1', name: 'Alice', balance: 0, status: 'active' },
    { id: '2', name: 'Bob', balance: 0, status: 'placeholder' },
  ],
  transactions,
  payments: [],
  customCategories: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
});

const openSelect = (label: RegExp) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  return within(screen.getByRole('listbox'));
};

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Groceries run' } });
  fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '20' } });
  fireEvent.click(openSelect(/payer/i).getByRole('option', { name: 'Alice' }));
};

const submitButton = (name: RegExp) => screen.getByRole('button', { name });

describe('TransactionForm category', () => {
  it('shows the presets, categories used in the group, and Other', () => {
    const group = makeGroup([makeTransaction({ category: 'Rent' })]);
    render(<TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={group} />);

    const listbox = openSelect(/category/i);
    const names = listbox.getAllByRole('option').map(o => o.textContent);
    expect(names).toEqual([
      'Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Utilities', 'Travel',
      'Rent',
      'Other…',
    ]);
  });

  it('submits the chosen preset category', () => {
    const onSubmit = vi.fn();
    render(<TransactionForm open onClose={vi.fn()} onSubmit={onSubmit} group={makeGroup()} />);

    fillRequiredFields();
    expect(submitButton(/add transaction/i)).toBeDisabled();

    fireEvent.click(openSelect(/category/i).getByRole('option', { name: 'Travel' }));
    expect(screen.queryByLabelText(/custom category/i)).not.toBeInTheDocument();

    fireEvent.click(submitButton(/add transaction/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'Travel' }));
  });

  it('asks for a custom value when Other is chosen and submits it', () => {
    const onSubmit = vi.fn();
    render(<TransactionForm open onClose={vi.fn()} onSubmit={onSubmit} group={makeGroup()} />);

    fillRequiredFields();
    fireEvent.click(openSelect(/category/i).getByRole('option', { name: 'Other…' }));

    const custom = screen.getByLabelText(/custom category/i);
    expect(submitButton(/add transaction/i)).toBeDisabled();

    fireEvent.change(custom, { target: { value: '  Pets  ' } });
    fireEvent.click(submitButton(/add transaction/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'Pets' }));
  });

  it('keeps a custom value that has no matching option when editing', () => {
    // Category isn't in this group's transactions, so it isn't a dropdown option
    const transaction = makeTransaction({ category: 'Pets' });
    const onSubmit = vi.fn();
    render(
      <TransactionForm open onClose={vi.fn()} onSubmit={onSubmit} group={makeGroup()} transaction={transaction} />
    );

    expect(screen.getByRole('combobox', { name: /category/i })).toHaveTextContent('Other…');
    expect(screen.getByLabelText(/custom category/i)).toHaveValue('Pets');

    fireEvent.click(submitButton(/save changes/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'Pets' }));
  });

  it('preselects an existing free-text category when editing, matching case-insensitively', () => {
    const transaction = makeTransaction({ category: 'food & dining' });
    const onSubmit = vi.fn();
    render(
      <TransactionForm
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        group={makeGroup([transaction])}
        transaction={transaction}
      />
    );

    expect(screen.getByRole('combobox', { name: /category/i })).toHaveTextContent('Food & Dining');
    expect(screen.queryByLabelText(/custom category/i)).not.toBeInTheDocument();

    fireEvent.click(submitButton(/save changes/i));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'Food & Dining' }));
  });
});

describe('TransactionForm keeps what was entered', () => {
  const memberField = (name: string) => screen.getByRole('spinbutton', { name: new RegExp(`^${name}`) });

  it('does not reset the form when the group is refreshed while it is open', () => {
    // A Firestore snapshot (e.g. someone else adding a transaction) hands the
    // form a new group object with new arrays but the same members.
    const group = makeGroup();
    const { rerender } = render(
      <TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={group} />
    );

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Groceries' } });
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: /exact/i }));
    fireEvent.change(memberField('Alice'), { target: { value: '40' } });

    const refreshed = {
      ...group,
      members: group.members.map(m => ({ ...m })),
      transactions: [makeTransaction({ category: 'Rent' })],
    };
    rerender(<TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={refreshed} />);

    expect(screen.getByLabelText(/description/i)).toHaveValue('Groceries');
    expect(screen.getByLabelText(/amount/i)).toHaveValue(42);
    expect(memberField('Alice')).toHaveValue(40);
  });

  it('adds a member who joins while the form is open, keeping entered splits', () => {
    const group = makeGroup();
    const { rerender } = render(
      <TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={group} />
    );
    fireEvent.click(screen.getByRole('button', { name: /exact/i }));
    fireEvent.change(memberField('Alice'), { target: { value: '5' } });

    const withCarol = {
      ...group,
      members: [...group.members, { id: '3', name: 'Carol', balance: 0, status: 'placeholder' as const }],
    };
    rerender(<TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={withCarol} />);

    expect(memberField('Alice')).toHaveValue(5);
    expect(memberField('Carol')).toBeInTheDocument();
  });

  it('keeps split values when switching split type and back', () => {
    render(<TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={makeGroup()} />);

    fireEvent.click(screen.getByRole('button', { name: /exact/i }));
    fireEvent.change(memberField('Alice'), { target: { value: '12.5' } });
    fireEvent.change(memberField('Bob'), { target: { value: '7.5' } });

    fireEvent.click(screen.getByRole('button', { name: /%/ }));
    fireEvent.click(screen.getByRole('button', { name: /exact/i }));

    expect(memberField('Alice')).toHaveValue(12.5);
    expect(memberField('Bob')).toHaveValue(7.5);
  });

  it('keeps who is included in an equal split when switching type and back', () => {
    render(<TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={makeGroup()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bob' }));
    fireEvent.click(screen.getByRole('button', { name: /shares/i }));
    fireEvent.click(screen.getByRole('button', { name: /equal/i }));

    expect(screen.getByRole('checkbox', { name: 'Bob' })).not.toBeChecked();
  });

  it('starts a new split type from its defaults when editing a transaction', () => {
    // An equal-split transaction switched to % should start at 50/50, not
    // reinterpret the equal-split inputs (all 0) as percentages.
    const transaction = makeTransaction();
    render(
      <TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={makeGroup([transaction])} transaction={transaction} />
    );

    fireEvent.click(screen.getByRole('button', { name: /%/ }));
    expect(memberField('Alice')).toHaveValue(50);
    expect(memberField('Bob')).toHaveValue(50);
  });

  it('does not clear a split field while a value like 0.50 is being typed', () => {
    render(<TransactionForm open onClose={vi.fn()} onSubmit={vi.fn()} group={makeGroup()} />);
    fireEvent.click(screen.getByRole('button', { name: /exact/i }));

    fireEvent.change(memberField('Alice'), { target: { value: '0' } });
    expect(memberField('Alice')).toHaveValue(0);
    fireEvent.change(memberField('Alice'), { target: { value: '0.5' } });
    expect(memberField('Alice')).toHaveValue(0.5);
  });
});
