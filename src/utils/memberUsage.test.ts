import { describe, it, expect } from 'vitest';
import { getMemberUsage, canRemoveMember } from './memberUsage';
import { Transaction, Payment } from '../types';

const now = new Date('2026-01-01');

function makeTransaction(
  id: string,
  payerId: string,
  splits: Array<[string, number]>
): Transaction {
  return {
    id,
    description: id,
    amount: splits.reduce((sum, [, amount]) => sum + amount, 0),
    date: now,
    category: 'Other',
    notes: '',
    payerId,
    splitType: 'equal',
    splits: splits.map(([memberId, amount]) => ({ memberId, amount })),
    createdAt: now,
    updatedAt: now,
  };
}

function makePayment(id: string, fromId: string, toId: string): Payment {
  return { id, fromId, toId, amount: 10, date: now, notes: '', createdAt: now, updatedAt: now };
}

describe('getMemberUsage', () => {
  it('returns zero counts for a member with no history', () => {
    const group = { transactions: [], payments: [] };
    expect(getMemberUsage(group, 'a')).toEqual({ transactionCount: 0, paymentCount: 0 });
  });

  it('counts transactions the member paid for', () => {
    const group = {
      transactions: [makeTransaction('t1', 'a', [['b', 10]])],
      payments: [],
    };
    expect(getMemberUsage(group, 'a').transactionCount).toBe(1);
  });

  it('counts transactions where the member has a nonzero share', () => {
    const group = {
      transactions: [makeTransaction('t1', 'a', [['a', 5], ['b', 5]])],
      payments: [],
    };
    expect(getMemberUsage(group, 'b').transactionCount).toBe(1);
  });

  it('ignores $0 splits, which every excluded member gets', () => {
    const group = {
      transactions: [makeTransaction('t1', 'a', [['a', 5], ['b', 5], ['c', 0]])],
      payments: [],
    };
    expect(getMemberUsage(group, 'c').transactionCount).toBe(0);
  });

  it('counts a transaction once even if the member both paid and has a share', () => {
    const group = {
      transactions: [makeTransaction('t1', 'a', [['a', 5], ['b', 5]])],
      payments: [],
    };
    expect(getMemberUsage(group, 'a').transactionCount).toBe(1);
  });

  it('counts payments sent and received', () => {
    const group = {
      transactions: [],
      payments: [makePayment('p1', 'a', 'b'), makePayment('p2', 'b', 'a'), makePayment('p3', 'b', 'c')],
    };
    expect(getMemberUsage(group, 'a').paymentCount).toBe(2);
    expect(getMemberUsage(group, 'c').paymentCount).toBe(1);
  });

  it('handles transactions with missing splits', () => {
    const transaction = makeTransaction('t1', 'a', []);
    const group = {
      transactions: [{ ...transaction, splits: undefined as unknown as Transaction['splits'] }],
      payments: [],
    };
    expect(getMemberUsage(group, 'b').transactionCount).toBe(0);
  });
});

describe('canRemoveMember', () => {
  it('allows removal when the member has no history', () => {
    expect(canRemoveMember({ transactionCount: 0, paymentCount: 0 })).toBe(true);
  });

  it('blocks removal when the member is in any transaction', () => {
    expect(canRemoveMember({ transactionCount: 1, paymentCount: 0 })).toBe(false);
  });

  it('blocks removal when the member is in any payment', () => {
    expect(canRemoveMember({ transactionCount: 0, paymentCount: 1 })).toBe(false);
  });
});
