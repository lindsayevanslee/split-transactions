import { useState } from 'react';
import { Paper, Typography, List, ListItem, ListItemText, Box, FormControlLabel, Switch, ButtonBase } from '@mui/material';
import { Group } from '../types';
import { DirectDebt, calculateBalances, calculateDebts, calculateDirectDebts, roundBalancesToCents } from '../utils/balances';
import DebtItemList from './DebtItemList';
import BalanceBreakdown from './BalanceBreakdown';
import BalanceChecks from './BalanceChecks';
import SettlementCheck from './SettlementCheck';

interface TransactionSummaryProps {
  group: Group;
}

const TransactionSummary = ({ group }: TransactionSummaryProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Rounded once, so the balances and settlements shown always add up
  const balances = roundBalancesToCents(calculateBalances(group));
  const debts = calculateDebts(group.members, balances);
  // Who owes whom per transaction, before combining into fewer payments
  const directDebts = calculateDirectDebts(group);
  const [simplified, setSimplified] = useState(true);
  const [openDebt, setOpenDebt] = useState<string | null>(null);
  const settlements = simplified ? debts : directDebts;

  const getMemberName = (memberId: string) => {
    return group.members.find(member => member.id === memberId)?.name || 'Unknown';
  };

  return (
    // Each section is a heading over its own box, like the other tabs
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box component="section">
        <Typography variant="h6" gutterBottom>Settlements Due</Typography>
        <Paper sx={{ p: 2 }}>
          {directDebts.length > debts.length && (
            <Box sx={{ mb: 1 }}>
              <FormControlLabel
                control={<Switch checked={simplified} onChange={(e) => { setSimplified(e.target.checked); setOpenDebt(null); }} />}
                label="Simplify payments"
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {simplified
                  ? `${debts.length} ${debts.length === 1 ? 'payment' : 'payments'} instead of ${directDebts.length}. Turn off to pay each person exactly what you owe them.`
                  : `Each payment is what one person owes another. Tap a payment to see why.`}
              </Typography>
            </Box>
          )}
          <List dense sx={{ bgcolor: 'background.paper' }}>
            {settlements.map((debt, index) => {
              const key = `${debt.from}-${debt.to}`;
              const items = simplified ? null : (debt as DirectDebt).items;
              const isOpen = openDebt === key;
              const row = (
              <ListItem
                key={index}
                sx={{
                  borderLeft: '3px solid',
                  borderColor: 'error.main',
                  mb: 0.5,
                  bgcolor: 'rgba(139, 0, 0, 0.03)'
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">
                        {getMemberName(debt.from)} <span style={{ opacity: 0.5 }}>→</span> {getMemberName(debt.to)}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontWeight: 600,
                          color: 'error.main'
                        }}
                      >
                        {formatCurrency(debt.amount)}
                      </Typography>
                    </Box>
                  }
                  secondary={items && isOpen ? <DebtItemList items={items} /> : undefined}
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
              );
              return items ? (
                <ButtonBase
                  key={key}
                  onClick={() => setOpenDebt(isOpen ? null : key)}
                  aria-expanded={isOpen}
                  sx={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  {row}
                </ButtonBase>
              ) : row;
            })}
            {settlements.length === 0 && (
              <ListItem sx={{ justifyContent: 'center' }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontStyle: 'italic',
                    color: 'success.main'
                  }}
                >
                  ✓ All accounts settled
                </Typography>
              </ListItem>
            )}
          </List>
          {settlements.length > 0 && (
            <SettlementCheck members={group.members} balances={balances} debts={settlements} directDebts={directDebts} simplified={simplified} />
          )}
        </Paper>
      </Box>

      <Box component="section">
        <Typography variant="h6" gutterBottom>Ledger Balances</Typography>
        <Paper sx={{ p: 2 }}>
          <BalanceBreakdown group={group} balances={balances} directDebts={directDebts} settlements={settlements} simplified={simplified} />
        </Paper>
      </Box>

      <Box component="section">
        <Typography variant="h6" gutterBottom>Checks</Typography>
        <Paper sx={{ p: 2 }}>
          <BalanceChecks group={group} balances={balances} />
        </Paper>
      </Box>
    </Box>
  );
};

export default TransactionSummary; 