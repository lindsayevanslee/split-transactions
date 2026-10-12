import { useState } from 'react';
import { Box, ButtonBase, Collapse, Typography } from '@mui/material';
import { Group } from '../types';
import { Debt, DirectDebt } from '../utils/balances';

interface SettlementCheckProps {
  members: Group['members'];
  balances: Map<string, number>;  // rounded to cents
  debts: Debt[];                  // the payments shown under Settlements Due
  directDebts: DirectDebt[];      // who owes whom before simplifying
  simplified: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const signed = (cents: number) =>
  cents === 0 ? formatCurrency(0) : `${cents > 0 ? '+' : '−'}${formatCurrency(Math.abs(cents) / 100)}`;

const toCents = (amount: number) => Math.round(amount * 100);

const mono = { fontFamily: '"IBM Plex Mono", monospace', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;
const credit = '#1a472a';
const debit = '#8b0000';

interface Line {
  label: string;
  cents: number;
}

// One step of the sum; `total` rows are subtotals with a rule above them
function SumRow({ label, value, total, color }: { label: string; value: string; total?: boolean; color?: string }) {
  return (
    <Box
      sx={{
        display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.25,
        ...(total && { borderTop: '1px solid', borderColor: 'divider', mt: 0.25, pt: 0.5 }),
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: total ? 700 : 400, minWidth: 0 }}>{label}</Typography>
      <Typography variant="body2" sx={{ ...mono, fontWeight: total ? 700 : 500, color }}>{value}</Typography>
    </Box>
  );
}

/**
 * Shows that the suggested settlements work, as a sum per member: their
 * balance (built up from their direct debts when payments were simplified),
 * plus each payment they'd send or receive, ending at $0.00. Worked in cents
 * so the lines add up exactly.
 */
const SettlementCheck = ({ members, balances, debts, directDebts, simplified }: SettlementCheckProps) => {
  const [open, setOpen] = useState(false);
  const name = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';

  // Only show how debts were combined when simplifying actually saved payments
  const combined = simplified && directDebts.length > debts.length;

  // Each direct debt is rounded to the cent separately, so paying them can
  // leave someone a cent or two off; simplified payments are exact.
  const tolerance = simplified ? 0 : Math.max(0, members.length - 1);
  const settled = (after: number) => Math.abs(after) <= tolerance;

  const rows = [...members]
    .sort((a, b) => (balances.get(b.id) || 0) - (balances.get(a.id) || 0))
    .map(member => {
      const balance = toCents(balances.get(member.id) || 0);

      // What the balance is made of: debts to others (−) and debts owed to them (+)
      const directLines: Line[] = combined ? [
        ...directDebts.filter(d => d.from === member.id).map(d => ({ label: `Owes ${name(d.to)}`, cents: -toCents(d.amount) })),
        ...directDebts.filter(d => d.to === member.id).map(d => ({ label: `${name(d.from)} owes them`, cents: toCents(d.amount) })),
      ] : [];
      const directTotal = directLines.reduce((sum, line) => sum + line.cents, 0);
      const rounding = combined ? balance - directTotal : 0;

      // Paying someone moves your balance up; receiving moves it down
      const paymentLines: Line[] = [
        ...debts.filter(d => d.from === member.id).map(d => ({ label: `Pays ${name(d.to)}`, cents: toCents(d.amount) })),
        ...debts.filter(d => d.to === member.id).map(d => ({ label: `Gets from ${name(d.from)}`, cents: -toCents(d.amount) })),
      ];
      const after = balance + paymentLines.reduce((sum, line) => sum + line.cents, 0);

      return { id: member.id, name: member.name, balance, directLines, rounding, paymentLines, after };
    });

  const allSettled = rows.every(row => settled(row.after));
  const anyRounding = rows.some(row => row.after !== 0 && settled(row.after));

  return (
    <Box sx={{ mt: 1 }}>
      <ButtonBase
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        sx={{ py: 0.5, color: 'primary.main', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 600 }}
      >
        {open ? '▾' : '▸'} Check these settlements
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 1, p: 1.5, border: '1px dashed', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            If everyone makes the payments above, each balance should end at $0.00.
            {combined && ' Simplified payments combine the direct debts between people, so fewer payments are needed and each person still pays or receives the same total.'}
          </Typography>

          {rows.map(row => (
            <Box key={row.id} sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>{row.name}</Typography>
              {row.directLines.map(line => <SumRow key={line.label} label={line.label} value={signed(line.cents)} />)}
              {row.rounding !== 0 && <SumRow label="Rounding to the cent" value={signed(row.rounding)} />}
              <SumRow label="Balance" value={signed(row.balance)} total={row.directLines.length > 0} />
              {row.paymentLines.map(line => <SumRow key={line.label} label={line.label} value={signed(line.cents)} />)}
              <SumRow
                label="After paying"
                value={`${settled(row.after) ? '✓' : '✗'} ${signed(row.after)}`}
                total
                color={settled(row.after) ? credit : debit}
              />
            </Box>
          ))}

          <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600, color: allSettled ? credit : debit }}>
            {allSettled
              ? anyRounding
                ? '✓ Checks out: these payments leave everyone within a cent or two of $0.00, from rounding each debt to the cent.'
                : '✓ Checks out: these payments leave everyone at $0.00.'
              : '✗ Someone would still have a balance after these payments.'}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

export default SettlementCheck;
