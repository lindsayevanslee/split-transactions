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

export interface MemberBreakdown {
  memberId: string;
  paid: number;      // total of transactions they paid for
  share: number;     // total of their shares across transactions
  sent: number;      // payments they made to others
  received: number;  // payments others made to them
}

/**
 * How each member's balance is made up, so people can check it:
 * balance = paid − share + sent − received. Gives the same balances as
 * calculateBalances (before rounding).
 */
export function calculateBreakdown(
  group: Pick<Group, 'members' | 'transactions' | 'payments'>
): Map<string, MemberBreakdown> {
  const breakdown = new Map<string, MemberBreakdown>();
  const get = (memberId: string) => {
    let entry = breakdown.get(memberId);
    if (!entry) {
      entry = { memberId, paid: 0, share: 0, sent: 0, received: 0 };
      breakdown.set(memberId, entry);
    }
    return entry;
  };
  group.members?.forEach(member => get(member.id));

  group.transactions?.forEach(transaction => {
    get(transaction.payerId).paid += transaction.amount;
    transaction.splits?.forEach(split => {
      get(split.memberId).share += split.amount;
    });
  });

  group.payments?.forEach(payment => {
    const from = get(payment.fromId);
    const to = get(payment.toId);
    from.sent += payment.amount;
    to.received += payment.amount;
  });

  return breakdown;
}

export interface DirectDebtItem {
  id: string;
  date: Date;
  label: string;   // names whose share or payment it is, e.g. "Groceries (Carol's share)"
  amount: number;  // positive increases what `from` owes `to`; negative reduces it
}

export interface DirectDebt extends Debt {
  items: DirectDebtItem[];
}

/**
 * Who owes whom without simplification, traced to transactions: everyone in
 * a split owes the payer their share, and a payment reduces what the payer
 * owed the recipient. Debts between the same two people are netted, so each
 * pair appears at most once.
 */
export function calculateDirectDebts(
  group: Pick<Group, 'members' | 'transactions' | 'payments'>
): DirectDebt[] {
  const name = (id: string) => group.members.find(m => m.id === id)?.name || 'Unknown';
  // Keyed by the pair in a fixed order (a < b); net > 0 means a owes b
  const pairs = new Map<string, { a: string; b: string; net: number; items: DirectDebtItem[] }>();

  const add = (debtor: string, creditor: string, amount: number, item: Omit<DirectDebtItem, 'amount'>) => {
    if (debtor === creditor || amount === 0) return;
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const key = `${a}|${b}`;
    let pair = pairs.get(key);
    if (!pair) {
      pair = { a, b, net: 0, items: [] };
      pairs.set(key, pair);
    }
    const signedAmount = debtor === a ? amount : -amount;  // relative to "a owes b"
    pair.net += signedAmount;
    pair.items.push({ ...item, amount: signedAmount });
  };

  group.transactions?.forEach(transaction => {
    transaction.splits?.forEach(split => {
      add(split.memberId, transaction.payerId, split.amount, {
        id: transaction.id,
        date: new Date(transaction.date),
        label: `${transaction.description} (${name(split.memberId)}'s share)`,
      });
    });
  });

  group.payments?.forEach(payment => {
    // Paying someone reduces what you owe them
    add(payment.fromId, payment.toId, -payment.amount, {
      id: payment.id,
      date: new Date(payment.date),
      label: `${name(payment.fromId)} paid ${name(payment.toId)}`,
    });
  });

  const debts: DirectDebt[] = [];
  pairs.forEach(pair => {
    const cents = Math.round(Math.abs(pair.net) * 100);
    if (cents === 0) return;
    const aOwes = pair.net > 0;
    debts.push({
      from: aOwes ? pair.a : pair.b,
      to: aOwes ? pair.b : pair.a,
      amount: cents / 100,
      items: pair.items
        .map(item => ({ ...item, amount: aOwes ? item.amount : -item.amount }))
        .sort((x, y) => y.date.getTime() - x.date.getTime()),
    });
  });
  return debts.sort((x, y) => y.amount - x.amount);
}
