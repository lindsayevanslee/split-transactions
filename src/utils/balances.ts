import { Group } from '../types';

export interface Debt {
  from: string;    // member who owes
  to: string;      // member who should receive
  amount: number;
}

/**
 * Net balance per member: what they paid for others minus what others paid
 * for them, adjusted by payments. Positive means the group owes them.
 */
export function calculateBalances(group: Pick<Group, 'members' | 'transactions' | 'payments'>): Map<string, number> {
  const balances = new Map<string, number>();

  // Initialize balances for all members
  group.members?.forEach(member => {
    balances.set(member.id, 0);
  });

  // Calculate transaction balances
  group.transactions?.forEach(transaction => {
    // For the payer, they paid the full amount but should only pay their share
    const payerShare = transaction.splits?.find(split => split.memberId === transaction.payerId)?.amount || 0;
    const payerBalance = balances.get(transaction.payerId) || 0;
    // The payer effectively receives (total amount - their share) because they paid more than their share
    balances.set(transaction.payerId, payerBalance + (transaction.amount - payerShare));

    // For other members, they owe their portion
    transaction.splits?.forEach(split => {
      if (split.memberId !== transaction.payerId) {
        const memberBalance = balances.get(split.memberId) || 0;
        balances.set(split.memberId, memberBalance - split.amount);
      }
    });
  });

  // Calculate payment balances
  group.payments?.forEach(payment => {
    // When someone makes a payment, reduce what they owe
    const fromBalance = balances.get(payment.fromId) || 0;
    balances.set(payment.fromId, fromBalance + payment.amount);

    // When someone receives a payment, reduce what they should receive
    const toBalance = balances.get(payment.toId) || 0;
    balances.set(payment.toId, toBalance - payment.amount);
  });

  return balances;
}

/**
 * Rounds balances to whole cents so they still add up to exactly zero.
 * Plain rounding can leave the group a cent off (three people sharing $100:
 * -33.33, -33.33, +66.67 is fine, but other splits can round the same way
 * on every side); the leftover cents go to the members whose balances were
 * rounded the furthest, so every displayed figure adds up.
 */
export function roundBalancesToCents(balances: Map<string, number>): Map<string, number> {
  const entries = [...balances].map(([id, balance]) => {
    const exact = balance * 100;
    const cents = Math.round(exact);
    return { id, cents, error: exact - cents };
  });

  let leftover = -entries.reduce((sum, e) => sum + e.cents, 0);
  // Only fix genuine rounding drift. A larger gap means the data itself
  // doesn't balance (e.g. a split that doesn't add up), which shouldn't be hidden.
  if (Math.abs(leftover) <= entries.length) {
    const byError = [...entries].sort((a, b) => (leftover > 0 ? b.error - a.error : a.error - b.error));
    for (let k = 0; leftover !== 0 && k < byError.length; k++) {
      const step = leftover > 0 ? 1 : -1;
      byError[k].cents += step;
      leftover -= step;
    }
  }

  return new Map(entries.map(e => [e.id, e.cents / 100]));
}

/**
 * Suggested payments that settle every balance: repeatedly match the member
 * owed the most with the member who owes the most. Works in whole cents, so
 * each step settles at least one member and the loop always finishes.
 */
export function calculateDebts(
  members: Group['members'],
  balances: Map<string, number>
): Debt[] {
  const debts: Debt[] = [];

  const sorted = members
    .map(member => ({ id: member.id, cents: Math.round((balances.get(member.id) || 0) * 100) }))
    .sort((a, b) => b.cents - a.cents);

  let i = 0;
  let j = sorted.length - 1;

  while (i < j) {
    const creditor = sorted[i];  // Owed the most
    const debtor = sorted[j];    // Owes the most
    if (creditor.cents <= 0 || debtor.cents >= 0) break;

    const amount = Math.min(creditor.cents, -debtor.cents);
    debts.push({ from: debtor.id, to: creditor.id, amount: amount / 100 });

    creditor.cents -= amount;
    debtor.cents += amount;
    if (creditor.cents === 0) i++;
    if (debtor.cents === 0) j--;
  }

  return debts;
}
