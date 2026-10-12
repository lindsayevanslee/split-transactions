import { Box, Typography } from '@mui/material';
import { DirectDebtItem } from '../utils/balances';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const signed = (amount: number) => {
  const cents = Math.round(amount * 100);
  if (cents === 0) return formatCurrency(0);
  return `${cents > 0 ? '+' : '−'}${formatCurrency(Math.abs(cents) / 100)}`;
};

/**
 * The transactions and payments behind one direct debt. "+" adds to what
 * the debtor owes, "−" takes away from it.
 */
const DebtItemList = ({ items }: { items: DirectDebtItem[] }) => (
  <Box sx={{ pl: 1.5, borderLeft: '2px solid', borderColor: 'divider', my: 0.5 }}>
    {items.map((item, i) => (
      <Box key={`${item.id}-${i}`} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0, overflowWrap: 'anywhere' }}>
          {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {item.label}
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: '"IBM Plex Mono", monospace', fontVariantNumeric: 'tabular-nums', color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {signed(item.amount)}
        </Typography>
      </Box>
    ))}
  </Box>
);

export default DebtItemList;
