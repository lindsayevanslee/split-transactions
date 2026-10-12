import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TransactionSummary from './TransactionSummary';
import SettlementCheck from './SettlementCheck';
import { Group, Transaction } from '../types';

const tx = (payerId: string, amount: number, splits: { memberId: string; amount: number }[]): Transaction => ({
  id: `t-${payerId}-${amount}`, description: 'Dinner', amount, date: new Date(2026, 9, 1, 12), category: 'Travel',
  notes: '', payerId, splitType: 'exact', splits, createdAt: new Date(), updatedAt: new Date(),
});

const group = (transactions: Transaction[]): Group => ({
  id: 'g', name: 'Trip', userId: 'u', memberUserIds: ['u'],
  members: [
    { id: 'a', name: 'Alice', balance: 0, status: 'active' },
    { id: 'b', name: 'Bob', balance: 0, status: 'active' },
    { id: 'c', name: 'Carol', balance: 0, status: 'active' },
  ],
  transactions, payments: [], customCategories: [], createdAt: new Date(), updatedAt: new Date(),
});

describe('Account Summary checks', () => {
  it('passes both checks when every split matches its amount', () => {
    render(<TransactionSummary group={group([tx('a', 90, [
      { memberId: 'a', amount: 30 }, { memberId: 'b', amount: 30 }, { memberId: 'c', amount: 30 },
    ])])} />);
    expect(screen.getAllByText('✓ Checks out')).toHaveLength(2);
  });

  it('flags a transaction whose split does not add up to its amount', () => {
    // $90 paid but only $60 shared out
    render(<TransactionSummary group={group([tx('a', 90, [
      { memberId: 'b', amount: 30 }, { memberId: 'c', amount: 30 },
    ])])} />);
    expect(screen.getAllByText(/Doesn’t add up/).length).toBeGreaterThan(0);
  });

  it('shows the settlements leaving everyone at $0.00', () => {
    render(<TransactionSummary group={group([tx('a', 90, [
      { memberId: 'a', amount: 30 }, { memberId: 'b', amount: 30 }, { memberId: 'c', amount: 30 },
    ])])} />);
    fireEvent.click(screen.getByRole('button', { name: /check these settlements/i }));
    expect(screen.getByText(/these payments leave everyone at \$0\.00/)).toBeInTheDocument();
    // Bob and Carol each pay Alice $30, shown as a line under each of them
    const paysAlice = screen.getAllByText('Pays Alice');
    expect(paysAlice).toHaveLength(2);
    paysAlice.forEach(label => expect(label.nextElementSibling).toHaveTextContent('+$30.00'));
    // Alice receives from both
    expect(screen.getByText('Gets from Bob').nextElementSibling).toHaveTextContent('−$30.00');
    expect(screen.getAllByText('✓ $0.00')).toHaveLength(3);
  });
});

describe('SettlementCheck', () => {
  it('warns when the suggested payments would not settle everyone', () => {
    const members = group([]).members;
    const balances = new Map([['a', 60], ['b', -30], ['c', -30]]);
    // Only one of the two needed payments
    render(<SettlementCheck members={members} balances={balances} debts={[{ from: 'b', to: 'a', amount: 30 }]} directDebts={[]} simplified />);
    fireEvent.click(screen.getByRole('button', { name: /check these settlements/i }));
    expect(screen.getByText(/Someone would still have a balance/)).toBeInTheDocument();
  });
});

describe('Simplify payments', () => {
  // A paid $90 for A, B, C; B paid $30 for C.
  // Direct: B owes A $30, C owes A $30, C owes B $30 (3 payments).
  // Simplified: B is even, so C pays A $60 (1 payment).
  const chain = () => group([
    tx('a', 90, [{ memberId: 'a', amount: 30 }, { memberId: 'b', amount: 30 }, { memberId: 'c', amount: 30 }]),
    { ...tx('b', 30, [{ memberId: 'c', amount: 30 }]), id: 't-b', description: 'Taxi' },
  ]);

  it('shows the simplified payments by default and the direct ones when switched off', () => {
    render(<TransactionSummary group={chain()} />);
    expect(screen.getByText('1 payment instead of 3. Turn off to pay each person exactly what you owe them.')).toBeInTheDocument();
    const payments = () => within(screen.getAllByRole('list')[0]);
    expect(payments().getByText('$60.00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /simplify payments/i }));
    expect(payments().queryByText('$60.00')).not.toBeInTheDocument();
    expect(payments().getAllByText('$30.00')).toHaveLength(3);
  });

  it('shows the transactions behind a direct payment when tapped', () => {
    render(<TransactionSummary group={chain()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /simplify payments/i }));
    // The C → B payment comes from the taxi
    const cToB = screen.getAllByRole('button', { expanded: false }).find(b => /Carol\s*→\s*Bob/.test(b.textContent || ''))!;
    fireEvent.click(cToB);
    expect(screen.getByText(/Taxi \(Carol's share\)/)).toBeInTheDocument();
  });

  it("traces each person's direct debts in their breakdown", () => {
    render(<TransactionSummary group={chain()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Carol/ }));
    expect(screen.getByText('Owes Alice')).toBeInTheDocument();
    expect(screen.getByText('Owes Bob')).toBeInTheDocument();
    expect(screen.getByText(/Dinner \(Carol's share\)/)).toBeInTheDocument();
    expect(screen.getByText('Settled with fewer payments')).toBeInTheDocument();
    expect(screen.getByText('Pays Alice')).toBeInTheDocument();
  });
});

describe('settlement check with simplified payments', () => {
  it("adds up each person's direct debts to their balance, then their payment to $0.00", () => {
    const chain = group([
      tx('a', 90, [{ memberId: 'a', amount: 30 }, { memberId: 'b', amount: 30 }, { memberId: 'c', amount: 30 }]),
      { ...tx('b', 30, [{ memberId: 'c', amount: 30 }]), id: 't-b', description: 'Taxi' },
    ]);
    render(<TransactionSummary group={chain} />);
    fireEvent.click(screen.getByRole('button', { name: /check these settlements/i }));

    // Carol: owes Alice 30 + owes Bob 30 = −60, pays Alice 60 → 0
    const check = within(screen.getByText(/each balance should end at \$0\.00/).parentElement!);
    const carol = check.getByText('Carol').parentElement!;
    const row = (label: string) => within(carol).getByText(label).nextElementSibling;
    expect(row('Owes Alice')).toHaveTextContent('−$30.00');
    expect(row('Owes Bob')).toHaveTextContent('−$30.00');
    expect(row('Balance')).toHaveTextContent('−$60.00');
    expect(row('Pays Alice')).toHaveTextContent('+$60.00');
    expect(row('After paying')).toHaveTextContent('✓ $0.00');
  });
});
