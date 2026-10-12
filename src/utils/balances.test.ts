import { describe, it, expect } from 'vitest';
import { calculateBalances, calculateDebts, calculateBreakdown, calculateDirectDebts, roundBalancesToCents } from './balances';
import { calculateSplits, getDefaultSplitInputs } from './splitCalculator';
import { Member, Payment, SplitType, Transaction } from '../types';

const member = (id: string): Member => ({ id, name: id, balance: 0, status: 'active' });
const tx = (payerId: string, amount: number, splits: { memberId: string; amount: number }[]): Transaction => ({
  id: Math.random().toString(36), description: '', amount, date: new Date(), category: 'Travel',
  notes: '', payerId, splitType: 'exact', splits, createdAt: new Date(), updatedAt: new Date(),
});
const pay = (fromId: string, toId: string, amount: number): Payment => ({
  id: Math.random().toString(36), fromId, toId, amount, date: new Date(), notes: '',
  createdAt: new Date(), updatedAt: new Date(),
});
const asObject = (m: Map<string, number>) => Object.fromEntries([...m].map(([k, v]) => [k, Math.round(v * 100) / 100]));

describe('calculateBalances', () => {
  const members = ['A', 'B', 'C'].map(member);

  it('credits the payer with what others owe and debits the others', () => {
    // A pays $90 split evenly: B and C each owe A $30
    const group = { members, payments: [], transactions: [tx('A', 90, [
      { memberId: 'A', amount: 30 }, { memberId: 'B', amount: 30 }, { memberId: 'C', amount: 30 },
    ])] };
    expect(asObject(calculateBalances(group))).toEqual({ A: 60, B: -30, C: -30 });
  });

  it('credits the full amount when the payer is not part of the split', () => {
    const group = { members, payments: [], transactions: [tx('A', 50, [
      { memberId: 'B', amount: 25 }, { memberId: 'C', amount: 25 },
    ])] };
    expect(asObject(calculateBalances(group))).toEqual({ A: 50, B: -25, C: -25 });
  });

  it('applies payments from the payer to the recipient', () => {
    const group = { members, payments: [pay('B', 'A', 30)], transactions: [tx('A', 90, [
      { memberId: 'A', amount: 30 }, { memberId: 'B', amount: 30 }, { memberId: 'C', amount: 30 },
    ])] };
    expect(asObject(calculateBalances(group))).toEqual({ A: 30, B: 0, C: -30 });
  });
});

describe('calculateDebts', () => {
  it('settles a simple group', () => {
    const balances = new Map([['A', 60], ['B', -30], ['C', -30]]);
    const debts = calculateDebts(['A', 'B', 'C'].map(member), balances);
    expect(debts.map(d => ({ ...d, amount: Math.round(d.amount * 100) / 100 }))).toEqual([
      { from: 'C', to: 'A', amount: 30 },
      { from: 'B', to: 'A', amount: 30 },
    ]);
  });

  it('returns nothing when everyone is settled', () => {
    expect(calculateDebts(['A', 'B'].map(member), new Map([['A', 0], ['B', 0]]))).toEqual([]);
  });
});

// Randomized check: build many groups with the app's own split calculator
// and verify the invariants a person would check by hand.
describe('balances and settlements on random groups', () => {
  // Small seeded RNG so failures are reproducible
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const cents = (max: number) => Math.round(rand() * max * 100) / 100 + 0.01;

  const randomGroup = () => {
    const ids = Array.from({ length: 2 + Math.floor(rand() * 6) }, (_, i) => `m${i}`);
    const members = ids.map(member);
    const transactions: Transaction[] = Array.from({ length: Math.floor(rand() * 12) }, () => {
      const amount = cents(500);
      const splitType = pick<SplitType>(['equal', 'percentage', 'exact', 'shares']);
      let inputs = getDefaultSplitInputs(ids, splitType);
      if (splitType === 'equal') {
        inputs = inputs.map(input => ({ ...input, included: rand() < 0.7 }));
        if (!inputs.some(input => input.included)) inputs[0].included = true;
      } else if (splitType === 'shares') {
        inputs = inputs.map(input => ({ ...input, value: Math.floor(rand() * 4) }));
        if (!inputs.some(input => input.value > 0)) inputs[0].value = 1;
      } else if (splitType === 'exact') {
        // Whole cents that add up to the amount, like a person would enter
        let remaining = Math.round(amount * 100);
        inputs = inputs.map((input, i) => {
          const share = i === inputs.length - 1 ? remaining : Math.floor(rand() * remaining);
          remaining -= share;
          return { ...input, value: share / 100 };
        });
      }
      return { ...tx(pick(ids), amount, calculateSplits(amount, splitType, inputs)), splitType };
    });
    const payments = Array.from({ length: Math.floor(rand() * 4) }, () => {
      const [from, to] = [pick(ids), pick(ids)];
      return pay(from, to, cents(100));
    });
    return { members, transactions, payments };
  };

  it('the breakdown (paid − share + sent − received) matches every balance', () => {
    for (let run = 0; run < 1000; run++) {
      const group = randomGroup();
      const balances = calculateBalances(group);
      const breakdown = calculateBreakdown(group);
      for (const [id, balance] of balances) {
        const b = breakdown.get(id)!;
        expect(b.paid - b.share + b.sent - b.received).toBeCloseTo(balance, 6);
      }
    }
  });

  it('balances always add up to zero', () => {
    for (let run = 0; run < 2000; run++) {
      const total = [...calculateBalances(randomGroup()).values()].reduce((a, b) => a + b, 0);
      expect(Math.abs(total)).toBeLessThan(0.005);
    }
  });

  it('suggested settlements clear every balance, using at most one fewer payment than members', () => {
    for (let run = 0; run < 2000; run++) {
      const group = randomGroup();
      const balances = roundBalancesToCents(calculateBalances(group));
      const debts = calculateDebts(group.members, balances);

      const after = new Map(balances);
      for (const debt of debts) {
        expect(debt.amount).toBeGreaterThan(0);
        expect(debt.from).not.toBe(debt.to);
        after.set(debt.from, after.get(debt.from)! + debt.amount);
        after.set(debt.to, after.get(debt.to)! - debt.amount);
      }
      for (const remaining of after.values()) expect(Math.abs(Math.round(remaining * 100))).toBe(0);
      expect(debts.length).toBeLessThanOrEqual(group.members.length - 1);
    }
  });
});

describe('settlement edge cases', () => {
  it('settles a balance of exactly one cent (used to loop forever)', () => {
    const debts = calculateDebts(['A', 'B'].map(member), new Map([['A', 0.01], ['B', -0.01]]));
    expect(debts).toEqual([{ from: 'B', to: 'A', amount: 0.01 }]);
  });

  it('gives whole-cent settlements that add up to each displayed balance', () => {
    // A pays $100 for three people: balances 66.67 / -33.33 / -33.33
    const group = { members: ['A', 'B', 'C'].map(member), payments: [], transactions: [
      { ...tx('A', 100, calculateSplits(100, 'equal', getDefaultSplitInputs(['A', 'B', 'C'], 'equal'))), splitType: 'equal' as const },
    ] };
    const balances = roundBalancesToCents(calculateBalances(group));
    const debts = calculateDebts(group.members, balances);
    const toA = debts.filter(d => d.to === 'A').reduce((sum, d) => sum + d.amount, 0);
    expect(Math.round(toA * 100)).toBe(Math.round(balances.get('A')! * 100));
  });
});

describe('roundBalancesToCents', () => {
  it('keeps the total at exactly zero', () => {
    // Each rounds down to 33.33, which would leave the group a cent short
    const rounded = roundBalancesToCents(new Map([['A', 33.334], ['B', 33.334], ['C', 33.333], ['D', -100.001]]));
    const totalCents = [...rounded.values()].reduce((sum, v) => sum + Math.round(v * 100), 0);
    expect(totalCents).toBe(0);
  });

  it('leaves a real imbalance visible rather than spreading it around', () => {
    const rounded = roundBalancesToCents(new Map([['A', 10], ['B', -5]]));
    expect([...rounded.values()]).toEqual([10, -5]);
  });
});

describe('calculateDirectDebts', () => {
  const members = ['A', 'B', 'C'].map(member);

  it('makes each person in a split owe the payer their share, netting each pair', () => {
    const group = { members, payments: [pay('B', 'A', 10)], transactions: [
      tx('A', 90, [{ memberId: 'A', amount: 30 }, { memberId: 'B', amount: 30 }, { memberId: 'C', amount: 30 }]),
      tx('B', 20, [{ memberId: 'A', amount: 10 }, { memberId: 'B', amount: 10 }]),
    ] };
    const debts = calculateDirectDebts(group).map(({ from, to, amount, items }) => ({ from, to, amount, items: items.map(i => i.amount) }));
    // B owes A: 30 (B's share) − 10 (A's share of B's expense) − 10 (B paid A) = 10
    expect(debts).toEqual([
      { from: 'C', to: 'A', amount: 30, items: [30] },
      { from: 'B', to: 'A', amount: 10, items: expect.arrayContaining([30, -10, -10]) },
    ]);
  });

  it('nets to the same total per person as their balance (within rounding)', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let run = 0; run < 500; run++) {
      const ids = ['A', 'B', 'C', 'D'];
      const transactions = Array.from({ length: 1 + Math.floor(rand() * 8) }, () => {
        const amount = Math.round(rand() * 30000) / 100 + 0.01;
        const splits = calculateSplits(amount, 'equal', getDefaultSplitInputs(ids, 'equal'));
        return tx(ids[Math.floor(rand() * 4)], amount, splits);
      });
      const group = { members: ids.map(member), transactions, payments: [pay('A', 'B', 5)] };
      const balances = calculateBalances(group);
      const debts = calculateDirectDebts(group);
      for (const id of ids) {
        const net = debts.reduce((sum, d) => sum + (d.to === id ? d.amount : 0) - (d.from === id ? d.amount : 0), 0);
        // Each pair is rounded to the cent, so allow up to a cent per pair (3 pairs per person)
        expect(Math.abs(net - balances.get(id)!)).toBeLessThanOrEqual(0.03 + 1e-9);
      }
    }
  });
});
