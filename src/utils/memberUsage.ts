import { Group } from '../types';

export interface MemberUsage {
  transactionCount: number;
  paymentCount: number;
}

// Count the transactions and payments that involve a member. Every transaction
// stores a split for every member (excluded members get a $0 split), so a
// member only counts as involved if they paid or have a nonzero share.
export function getMemberUsage(
  group: Pick<Group, 'transactions' | 'payments'>,
  memberId: string
): MemberUsage {
  const transactionCount = group.transactions.filter(
    t =>
      t.payerId === memberId ||
      (t.splits ?? []).some(s => s.memberId === memberId && s.amount !== 0)
  ).length;

  const paymentCount = group.payments.filter(
    p => p.fromId === memberId || p.toId === memberId
  ).length;

  return { transactionCount, paymentCount };
}

// A member can only be removed if no transactions or payments involve them.
// Removing someone with history would drop their share from the balances and
// leave the remaining members' balances not adding up.
export function canRemoveMember(usage: MemberUsage): boolean {
  return usage.transactionCount === 0 && usage.paymentCount === 0;
}
