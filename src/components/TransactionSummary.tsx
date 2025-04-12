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
      const fromBalance = balances.get(payment.fromMemberId) || 0;
      balances.set(payment.fromMemberId, fromBalance + payment.amount);

      // When someone receives a payment, reduce what they should receive
      const toBalance = balances.get(payment.toMemberId) || 0;
      balances.set(payment.toMemberId, toBalance - payment.amount);
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
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Transaction Summary
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Who Owes Whom
        </Typography>
        <List dense>
          {debts.map((debt, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={`${getMemberName(debt.from)} → ${getMemberName(debt.to)}`}
                secondary={formatCurrency(debt.amount)}
                sx={{ color: 'error.main' }}
              />
            </ListItem>
          ))}
          {debts.length === 0 && (
            <ListItem>
              <ListItemText primary="No debts to settle" />
            </ListItem>
          )}
        </List>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Net Balances
        </Typography>
        <List dense>
          {sortedMembers.map((member) => {
            const balance = balances.get(member.id) || 0;
            return (
              <ListItem key={member.id}>
                <ListItemText
                  primary={member.name}
                  secondary={
                    <Typography
                      component="span"
                      variant="body2"
                      color={balance > 0 ? 'success.main' : balance < 0 ? 'error.main' : 'text.secondary'}
                    >
                      {balance > 0 ? 'Receives' : balance < 0 ? 'Owes' : 'Settled'}: {formatCurrency(Math.abs(balance))}
                    </Typography>
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