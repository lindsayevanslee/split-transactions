import { useState, type ReactNode } from 'react';
import { Box, ButtonBase, Collapse, Typography } from '@mui/material';
import { Group } from '../types';
import { Debt, DirectDebt, MemberBreakdown, calculateBreakdown } from '../utils/balances';
import DebtItemList from './DebtItemList';
import { formatCurrency, signedCurrency } from '../utils/money';

interface BalanceBreakdownProps {
  group: Group;
  balances: Map<string, number>;  // rounded to cents
  directDebts: DirectDebt[];      // who owes whom, traced to transactions
  settlements: Debt[];            // the payments shown under Settlements Due
  simplified: boolean;
}

const signed = signedCurrency;

const mono = { fontFamily: '"IBM Plex Mono", monospace', fontVariantNumeric: 'tabular-nums' };

export const credit = '#1a472a';
export const debit = '#8b0000';

export function EquationRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.25, ...(strong && { borderTop: '1px solid', borderColor: 'divider', mt: 0.5, pt: 0.75 }) }}>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 400 }}>{label}</Typography>
      <Typography variant="body2" sx={{ ...mono, fontWeight: strong ? 700 : 500, whiteSpace: 'nowrap' }}>{value}</Typography>
    </Box>
  );
}

const toCents = (amount: number) => Math.round(amount * 100);

function MemberDetail({ memberId, breakdown, balance, directDebts, settlements, simplified, name }: {
  memberId: string;
  breakdown: MemberBreakdown;
  balance: number;
  directDebts: DirectDebt[];
  settlements: Debt[];
  simplified: boolean;
  name: (id: string) => string;
}) {
  // Balances are rounded so the whole group totals exactly $0.00, which can
  // move one person's balance by a cent. Show that cent so the rows add up.
  const rounding = toCents(balance) - (toCents(breakdown.paid) - toCents(breakdown.share) + toCents(breakdown.sent) - toCents(breakdown.received));
  const owes = directDebts.filter(d => d.from === memberId);
  const owed = directDebts.filter(d => d.to === memberId);
  const pays = settlements.filter(d => d.from === memberId);
  const gets = settlements.filter(d => d.to === memberId);
  const directNet = owed.reduce((sum, d) => sum + toCents(d.amount), 0) - owes.reduce((sum, d) => sum + toCents(d.amount), 0);

  return (
    <Box sx={{ px: 1.5, pb: 1.5, pt: 0.5, bgcolor: '#f5f0e1', borderTop: '1px dashed', borderColor: 'divider' }}>
      <EquationRow label="Paid for the group" value={signed(breakdown.paid)} />
      <EquationRow label="Their share of expenses" value={signed(-breakdown.share)} />
      {breakdown.sent > 0 && <EquationRow label="Payments they sent" value={signed(breakdown.sent)} />}
      {breakdown.received > 0 && <EquationRow label="Payments they received" value={signed(-breakdown.received)} />}
      {rounding !== 0 && <EquationRow label="Rounding to the cent" value={signed(rounding / 100)} />}
      <EquationRow label="Balance" value={signed(balance)} strong />

      {(owes.length > 0 || owed.length > 0) && (
        <Box sx={{ mt: 1.5 }}>
          <SectionLabel>Who owes whom</SectionLabel>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            Under each debt, + adds to it and − reduces it.
          </Typography>
          {owes.map(d => (
            <Box key={`owes-${d.to}`} sx={{ mt: 0.75 }}>
              <EquationRow label={`Owes ${name(d.to)}`} value={formatCurrency(d.amount)} />
              <DebtItemList items={d.items} />
            </Box>
          ))}
          {owed.map(d => (
            <Box key={`owed-${d.from}`} sx={{ mt: 0.75 }}>
              <EquationRow label={`${name(d.from)} owes them`} value={formatCurrency(d.amount)} />
              <DebtItemList items={d.items} />
            </Box>
          ))}
          <EquationRow
            label="Overall"
            value={directNet < 0 ? `owes ${formatCurrency(-directNet / 100)}` : directNet > 0 ? `is owed ${formatCurrency(directNet / 100)}` : 'settled'}
            strong
          />
          {directNet !== toCents(balance) && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              Each debt is rounded to the cent, so this can differ from the balance by a cent or two.
            </Typography>
          )}
        </Box>
      )}

      {(pays.length > 0 || gets.length > 0) && (
        <Box sx={{ mt: 1.5 }}>
          <SectionLabel>{simplified ? 'Settled with fewer payments' : 'Settled by'}</SectionLabel>
          {pays.map(d => <EquationRow key={`pays-${d.to}`} label={`Pays ${name(d.to)}`} value={formatCurrency(d.amount)} />)}
          {gets.map(d => <EquationRow key={`gets-${d.from}`} label={`Gets from ${name(d.from)}`} value={formatCurrency(d.amount)} />)}
          {simplified && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
              Simplified payments combine the debts above so the group makes fewer payments. Each person still pays or receives the same total.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
      {children}
    </Typography>
  );
}

/**
 * Each member's balance as a bar either side of zero (right and green: the
 * group owes them; left and red: they owe the group). Tapping a member shows
 * how the balance was worked out, and the footer checks the totals.
 */
const BalanceBreakdown = ({ group, balances, directDebts, settlements, simplified }: BalanceBreakdownProps) => {
  const name = (id: string) => group.members.find(m => m.id === id)?.name || 'Unknown';
  const [expanded, setExpanded] = useState<string | null>(null);
  const breakdown = calculateBreakdown(group);

  const members = [...group.members].sort((a, b) => (balances.get(b.id) || 0) - (balances.get(a.id) || 0));
  const maxAbs = Math.max(0.01, ...members.map(m => Math.abs(balances.get(m.id) || 0)));

  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Tap a name to see how their balance is worked out.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {members.map(member => {
          const balance = balances.get(member.id) || 0;
          const widthPct = (Math.abs(balance) / maxAbs) * 50;
          const isCredit = balance > 0;
          const isDebit = balance < 0;
          const isOpen = expanded === member.id;
          const memberBreakdown = breakdown.get(member.id);
          return (
            <Box key={member.id} sx={{ border: '1px solid', borderColor: isOpen ? 'primary.main' : 'divider', bgcolor: 'background.paper' }}>
              <ButtonBase
                onClick={() => setExpanded(isOpen ? null : member.id)}
                aria-expanded={isOpen}
                sx={{ display: 'block', width: '100%', textAlign: 'left', px: 1.5, py: 1 }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {member.name} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{isOpen ? '▾' : '▸'}</Box>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {isCredit ? 'is owed ' : isDebit ? 'owes ' : 'settled'}
                    {(isCredit || isDebit) && (
                      <Box component="span" sx={{ ...mono, fontWeight: 600, color: 'text.primary' }}>
                        {formatCurrency(Math.abs(balance))}
                      </Box>
                    )}
                  </Typography>
                </Box>
                {/* Diverging bar: zero in the middle */}
                <Box sx={{ position: 'relative', height: 10, mt: 0.75 }} aria-hidden>
                  <Box sx={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: '1px', bgcolor: 'text.secondary', opacity: 0.5 }} />
                  {widthPct > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 1,
                        height: 8,
                        width: `max(${widthPct}%, 2px)`,
                        bgcolor: isCredit ? credit : debit,
                        ...(isCredit
                          ? { left: 'calc(50% + 1px)', borderRadius: '0 4px 4px 0' }
                          : { right: 'calc(50% + 1px)', borderRadius: '4px 0 0 4px' }),
                      }}
                    />
                  )}
                </Box>
              </ButtonBase>
              <Collapse in={isOpen} unmountOnExit>
                {memberBreakdown && (
                  <MemberDetail
                    memberId={member.id}
                    breakdown={memberBreakdown}
                    balance={balance}
                    directDebts={directDebts}
                    settlements={settlements}
                    simplified={simplified}
                    name={name}
                  />
                )}
              </Collapse>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }} aria-hidden>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>← owes</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>is owed →</Typography>
      </Box>
    </Box>
  );
};

export default BalanceBreakdown;
