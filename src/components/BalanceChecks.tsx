import { Box, Typography } from '@mui/material';
import { Group } from '../types';
import { calculateBreakdown } from '../utils/balances';
import { EquationRow, credit, debit } from './BalanceBreakdown';
import { formatCurrency, signedCurrency as signed } from '../utils/money';

interface BalanceChecksProps {
  group: Group;
  balances: Map<string, number>;  // rounded to cents
}

function CheckCard({ title, explanation, rows, result, ok }: {
  title: string;
  explanation: string;
  rows: { label: string; value: string }[];
  result: string;
  ok: boolean;
}) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>{explanation}</Typography>
      {rows.map(row => <EquationRow key={row.label} label={row.label} value={row.value} />)}
      <EquationRow label="Should be $0.00" value={result} strong />
      <Typography variant="body2" sx={{ color: ok ? credit : debit, fontWeight: 600 }}>
        {ok ? '✓ Checks out' : '✗ Doesn’t add up. A transaction’s split may not match its amount.'}
      </Typography>
    </Box>
  );
}

/**
 * Two sums that should each come to $0.00 if the group's records are
 * consistent: total paid minus everyone's shares, and all balances added up.
 */
const BalanceChecks = ({ group, balances }: BalanceChecksProps) => {
  const breakdown = calculateBreakdown(group);
  const members = [...group.members].sort((a, b) => (balances.get(b.id) || 0) - (balances.get(a.id) || 0));

  const totals = [...breakdown.values()].reduce(
    (t, b) => ({ paid: t.paid + b.paid, share: t.share + b.share }),
    { paid: 0, share: 0 }
  );
  const balanceTotal = [...balances.values()].reduce((sum, b) => sum + Math.round(b * 100), 0) / 100;
  const sharesMatch = Math.abs(totals.paid - totals.share) < 0.005 * Math.max(1, group.transactions.length);
  const balancesZero = balanceTotal === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      <CheckCard
        title="1. Everything paid was shared out"
        explanation="Every dollar someone paid should be split among the group, so total paid minus total shares should be $0.00."
        rows={[
          { label: 'Total paid for expenses', value: formatCurrency(totals.paid) },
          { label: "Minus everyone's shares", value: `−${formatCurrency(totals.share)}` },
        ]}
        result={formatCurrency(Math.round((totals.paid - totals.share) * 100) / 100)}
        ok={sharesMatch}
      />

      <CheckCard
        title="2. Balances cancel out"
        explanation="What some people are owed should exactly match what others owe, so all balances added together should be $0.00. Payments between members move money from one balance to another, so they don't change the total."
        rows={members.map(m => ({ label: m.name, value: signed(balances.get(m.id) || 0) }))}
        result={formatCurrency(balanceTotal)}
        ok={balancesZero}
      />
    </Box>
  );
};

export default BalanceChecks;
