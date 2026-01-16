import { Paper, Typography, List, ListItem, ListItemText, Box, Divider } from '@mui/material';
import { Group } from '../types';

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

  const calculateBalances = () => {
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
  };

  const calculateDebts = (balances: Map<string, number>) => {
    const debts: Array<{
      from: string;
      to: string;
      amount: number;
    }> = [];

    const members = [...group.members];
    const sortedBalances = members
      .map(member => ({
        id: member.id,
        name: member.name,
        balance: balances.get(member.id) || 0
      }))
      .sort((a, b) => b.balance - a.balance);

    let i = 0;
    let j = sortedBalances.length - 1;

    while (i < j) {
      const creditor = sortedBalances[i];  // Person who should receive money
      const debtor = sortedBalances[j];    // Person who owes money

      if (Math.abs(creditor.balance) > 0.01 && Math.abs(debtor.balance) > 0.01) {
        const amount = Math.min(creditor.balance, Math.abs(debtor.balance));
        debts.push({
          from: debtor.id,    // Person who owes
          to: creditor.id,    // Person who should receive
          amount
        });

        creditor.balance -= amount;
        debtor.balance += amount;

        if (Math.abs(creditor.balance) < 0.01) i++;
        if (Math.abs(debtor.balance) < 0.01) j--;
      } else {
        if (Math.abs(creditor.balance) < 0.01) i++;
        if (Math.abs(debtor.balance) < 0.01) j--;
      }
    }

    return debts;
  };

  const balances = calculateBalances();
  const debts = calculateDebts(balances);
  const sortedMembers = [...group.members].sort((a, b) => {
    const balanceA = balances.get(a.id) || 0;
    const balanceB = balances.get(b.id) || 0;
    return balanceB - balanceA;
  });

  const getMemberName = (memberId: string) => {
    return group.members.find(member => member.id === memberId)?.name || 'Unknown';
  };

  return (
    <Paper sx={{ p: 3 }} className="flourish">
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          textAlign: 'center',
          borderBottom: '2px double',
          borderColor: 'divider',
          pb: 1,
          mb: 2
        }}
      >
        Account Summary
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography
          variant="subtitle2"
          sx={{
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'text.secondary',
            mb: 1
          }}
        >
          Settlements Due
        </Typography>
        <List dense sx={{ bgcolor: 'background.paper' }}>
          {debts.map((debt, index) => (
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
              />
            </ListItem>
          ))}
          {debts.length === 0 && (
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
      </Box>

      <Divider sx={{ my: 2, borderStyle: 'dashed' }} />

      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'text.secondary',
            mb: 1
          }}
        >
          Ledger Balances
        </Typography>
        <List dense>
          {sortedMembers.map((member) => {
            const balance = balances.get(member.id) || 0;
            const isCredit = balance > 0;
            const isDebit = balance < 0;
            return (
              <ListItem
                key={member.id}
                sx={{
                  borderLeft: '3px solid',
                  borderColor: isCredit ? 'success.main' : isDebit ? 'error.main' : 'divider',
                  mb: 0.5,
                  bgcolor: isCredit ? 'rgba(26, 71, 42, 0.03)' : isDebit ? 'rgba(139, 0, 0, 0.03)' : 'transparent'
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">{member.name}</Typography>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'text.secondary',
                            fontSize: '0.65rem'
                          }}
                        >
                          {isCredit ? 'Credit' : isDebit ? 'Debit' : 'Balanced'}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontWeight: 600,
                            color: isCredit ? 'success.main' : isDebit ? 'error.main' : 'text.secondary'
                          }}
                        >
                          {formatCurrency(Math.abs(balance))}
                        </Typography>
                      </Box>
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Paper>
  );
};

export default TransactionSummary; 