import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Add as AddIcon, Edit as EditIcon, People as PeopleIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Payment as PaymentIcon } from '@mui/icons-material';
import { useApp } from '../context/AppContext';
import { DEFAULT_CATEGORIES, Transaction, Payment } from '../types';
import TransactionSummary from './TransactionSummary';
import MemberManagement from './MemberManagement';
import ConfirmationDialog from './ConfirmationDialog';

const GroupDetails = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups, updateGroup } = useApp();
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'transaction' | 'member'; id: string } | null>(null);
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    notes: '',
    payerId: '',
    splitType: 'even' as 'even' | 'custom',
    splitMethod: 'amount' as 'amount' | 'percentage',
    splits: [] as { memberId: string; amount: number; percentage?: number }[],
  });
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    fromMemberId: '',
    toMemberId: '',
    notes: '',
  });

  console.log('GroupDetails rendered with groupId:', groupId);
  console.log('Available groups:', groups);
  
  const group = groups.find(g => g.id === groupId);
  console.log('Found group:', group);

  if (!group) {
    console.log('Group not found, returning error message');
    return <Typography>Group not found</Typography>;
  }

  const handleDeleteClick = (type: 'transaction' | 'member', id: string) => {
    setItemToDelete({ type, id });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;

    const updatedGroup = { ...group };
    
    if (itemToDelete.type === 'transaction') {
      updatedGroup.transactions = group.transactions.filter(t => t.id !== itemToDelete.id);
    } else {
      // Check if member is involved in any transactions
      const isPayer = group.transactions.some(t => t.payerId === itemToDelete.id);
      const isInvolvedInSplits = group.transactions.some(t => 
        t.splits.some(s => s.memberId === itemToDelete.id)
      );

      if (isPayer || isInvolvedInSplits) {
        // Show error in member management dialog
        return;
      }

      updatedGroup.members = group.members.filter(m => m.id !== itemToDelete.id);
    }

    updateGroup(updatedGroup);
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setNewTransaction({
      amount: transaction.amount.toString(),
      date: new Date(transaction.date).toISOString().split('T')[0],
      category: transaction.category,
      notes: transaction.notes,
      payerId: transaction.payerId,
      splitType: transaction.splits.length === group.members.length && 
                transaction.splits.every(split => split.amount === transaction.amount / group.members.length)
        ? 'even'
        : 'custom',
      splitMethod: 'amount',
      splits: transaction.splits,
    });
    setTransactionDialogOpen(true);
  };

  const handleUpdateTransaction = () => {
    if (newTransaction.amount && newTransaction.category && newTransaction.payerId && editingTransaction) {
      const amount = parseFloat(newTransaction.amount);
      const splits = newTransaction.splitType === 'even'
        ? group.members.map(member => ({
            memberId: member.id,
            amount: amount / group.members.length,
          }))
        : newTransaction.splits;

      const updatedGroup = {
        ...group,
        transactions: group.transactions.map(transaction =>
          transaction.id === editingTransaction.id
            ? {
                ...transaction,
                amount,
                date: new Date(newTransaction.date),
                category: newTransaction.category,
                notes: newTransaction.notes,
                payerId: newTransaction.payerId,
                splits,
              }
            : transaction
        ),
      };
      updateGroup(updatedGroup);
      setTransactionDialogOpen(false);
      setEditingTransaction(null);
      setNewTransaction({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        notes: '',
        payerId: '',
        splitType: 'even',
        splitMethod: 'amount',
        splits: [],
      });
    }
  };

  const handleAddTransaction = () => {
    if (newTransaction.amount && newTransaction.category && newTransaction.payerId) {
      const amount = parseFloat(newTransaction.amount);
      const splits = newTransaction.splitType === 'even'
        ? group.members.map(member => ({
            memberId: member.id,
            amount: amount / group.members.length,
          }))
        : newTransaction.splits;

      const updatedGroup = {
        ...group,
        transactions: [
          ...group.transactions,
          {
            id: crypto.randomUUID(),
            amount,
            date: new Date(newTransaction.date),
            category: newTransaction.category,
            notes: newTransaction.notes,
            payerId: newTransaction.payerId,
            splits,
          },
        ],
      };
      updateGroup(updatedGroup);
      setTransactionDialogOpen(false);
      setNewTransaction({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        notes: '',
        payerId: '',
        splitType: 'even',
        splitMethod: 'amount',
        splits: [],
      });
    }
  };

  const handleSplitTypeChange = (type: 'even' | 'custom') => {
    setNewTransaction(prev => ({
      ...prev,
      splitType: type,
      splits: type === 'even' ? [] : group.members.map(member => ({
        memberId: member.id,
        amount: 0,
      })),
    }));
  };

  const handleSplitMethodChange = (method: 'amount' | 'percentage') => {
    setNewTransaction(prev => ({
      ...prev,
      splitMethod: method,
      splits: group.members.map(member => ({
        memberId: member.id,
        amount: 0,
        percentage: method === 'percentage' ? 0 : undefined,
      })),
    }));
  };

  const handleSplitAmountChange = (memberId: string, amount: string) => {
    const totalAmount = parseFloat(newTransaction.amount) || 0;
    const newAmount = parseFloat(amount) || 0;
    const currentTotal = newTransaction.splits.reduce((sum, split) => sum + (split.amount || 0), 0);
    const otherSplits = newTransaction.splits.filter(split => split.memberId !== memberId);
    const otherTotal = otherSplits.reduce((sum, split) => sum + (split.amount || 0), 0);

    // If the new amount would exceed the total, cap it at the remaining amount
    const finalAmount = Math.min(newAmount, totalAmount - otherTotal);

    setNewTransaction(prev => ({
      ...prev,
      splits: prev.splits.map(split =>
        split.memberId === memberId
          ? { ...split, amount: finalAmount }
          : split
      ),
    }));
  };

  const handleSplitPercentageChange = (memberId: string, percentage: string) => {
    const newPercentage = parseFloat(percentage) || 0;
    const totalAmount = parseFloat(newTransaction.amount) || 0;
    const currentTotal = newTransaction.splits.reduce((sum, split) => sum + (split.percentage || 0), 0);
    const otherSplits = newTransaction.splits.filter(split => split.memberId !== memberId);
    const otherTotal = otherSplits.reduce((sum, split) => sum + (split.percentage || 0), 0);

    // If the new percentage would exceed 100%, cap it at the remaining percentage
    const finalPercentage = Math.min(newPercentage, 100 - otherTotal);

    setNewTransaction(prev => ({
      ...prev,
      splits: prev.splits.map(split =>
        split.memberId === memberId
          ? { 
              ...split, 
              percentage: finalPercentage,
              amount: (finalPercentage / 100) * totalAmount
            }
          : split
      ),
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const calculateRemainingAmount = () => {
    const totalAmount = parseFloat(newTransaction.amount) || 0;
    const currentTotal = newTransaction.splits.reduce((sum, split) => sum + (split.amount || 0), 0);
    return totalAmount - currentTotal;
  };

  const calculateRemainingPercentage = () => {
    const currentTotal = newTransaction.splits.reduce((sum, split) => sum + (split.percentage || 0), 0);
    return 100 - currentTotal;
  };

  const handleAddPayment = () => {
    if (newPayment.amount && newPayment.fromMemberId && newPayment.toMemberId) {
      const updatedGroup = {
        ...group,
        payments: [
          ...group.payments,
          {
            id: crypto.randomUUID(),
            amount: parseFloat(newPayment.amount),
            date: new Date(newPayment.date),
            fromMemberId: newPayment.fromMemberId,
            toMemberId: newPayment.toMemberId,
            notes: newPayment.notes,
          },
        ],
      };
      updateGroup(updatedGroup);
      setPaymentDialogOpen(false);
      setNewPayment({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        fromMemberId: '',
        toMemberId: '',
        notes: '',
      });
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    const updatedGroup = {
      ...group,
      payments: group.payments.filter(p => p.id !== paymentId),
    };
    updateGroup(updatedGroup);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <IconButton onClick={() => navigate('/')} size="large">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {group.name}
          </Typography>
        </div>
        <div>
          <Button
            variant="outlined"
            startIcon={<PeopleIcon />}
            onClick={() => setMemberDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Manage Members
          </Button>
          <Button
            variant="outlined"
            startIcon={<PaymentIcon />}
            onClick={() => setPaymentDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Record Payment
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingTransaction(null);
              setNewTransaction({
                amount: '',
                date: new Date().toISOString().split('T')[0],
                category: '',
                notes: '',
                payerId: '',
                splitType: 'even',
                splitMethod: 'amount',
                splits: [],
              });
              setTransactionDialogOpen(true);
            }}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <TransactionSummary group={group} />
        </Grid>
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Members
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {group.members.map((member) => (
                <Chip
                  key={member.id}
                  label={member.name}
                  variant="outlined"
                  sx={{ m: 0.5 }}
                />
              ))}
              {group.members.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No members yet
                </Typography>
              )}
            </Box>

            <Typography variant="h6" gutterBottom>
              Transactions
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Paid By</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...group.transactions]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                        <TableCell>{group.members.find(m => m.id === transaction.payerId)?.name}</TableCell>
                        <TableCell>{transaction.notes}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleEditTransaction(transaction)}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick('transaction', transaction.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  {group.transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No transactions yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <MemberManagement
        group={group}
        open={memberDialogOpen}
        onClose={() => setMemberDialogOpen(false)}
        onUpdateGroup={updateGroup}
        onDeleteMember={(memberId) => handleDeleteClick('member', memberId)}
      />

      <Dialog 
        open={transactionDialogOpen} 
        onClose={() => {
          setTransactionDialogOpen(false);
          setEditingTransaction(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Amount"
            type="number"
            fullWidth
            value={newTransaction.amount}
            onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Date"
            type="date"
            fullWidth
            value={newTransaction.date}
            onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Category</InputLabel>
            <Select
              value={newTransaction.category}
              label="Category"
              onChange={(e) => setNewTransaction(prev => ({ ...prev, category: e.target.value }))}
            >
              {DEFAULT_CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Notes"
            fullWidth
            value={newTransaction.notes}
            onChange={(e) => setNewTransaction(prev => ({ ...prev, notes: e.target.value }))}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Paid By</InputLabel>
            <Select
              value={newTransaction.payerId}
              label="Paid By"
              onChange={(e) => setNewTransaction(prev => ({ ...prev, payerId: e.target.value }))}
            >
              {group.members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Split Type</InputLabel>
            <Select
              value={newTransaction.splitType}
              label="Split Type"
              onChange={(e) => handleSplitTypeChange(e.target.value as 'even' | 'custom')}
            >
              <MenuItem value="even">Split Evenly</MenuItem>
              <MenuItem value="custom">Custom Split</MenuItem>
            </Select>
          </FormControl>
          {newTransaction.splitType === 'custom' && (
            <>
              <FormControl fullWidth margin="dense">
                <InputLabel>Split Method</InputLabel>
                <Select
                  value={newTransaction.splitMethod}
                  label="Split Method"
                  onChange={(e) => handleSplitMethodChange(e.target.value as 'amount' | 'percentage')}
                >
                  <MenuItem value="amount">Split by Amount</MenuItem>
                  <MenuItem value="percentage">Split by Percentage</MenuItem>
                </Select>
              </FormControl>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Remaining: {newTransaction.splitMethod === 'amount' 
                    ? formatCurrency(calculateRemainingAmount())
                    : `${calculateRemainingPercentage().toFixed(1)}%`}
                </Typography>
                {group.members.map((member) => (
                  <Box key={member.id} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{member.name}</Typography>
                    <TextField
                      size="small"
                      label={newTransaction.splitMethod === 'amount' ? 'Amount' : 'Percentage'}
                      type="number"
                      value={newTransaction.splitMethod === 'amount'
                        ? newTransaction.splits.find(s => s.memberId === member.id)?.amount || 0
                        : newTransaction.splits.find(s => s.memberId === member.id)?.percentage || 0}
                      onChange={(e) => newTransaction.splitMethod === 'amount'
                        ? handleSplitAmountChange(member.id, e.target.value)
                        : handleSplitPercentageChange(member.id, e.target.value)}
                      fullWidth
                    />
                  </Box>
                ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setTransactionDialogOpen(false);
            setEditingTransaction(null);
          }}>
            Cancel
          </Button>
          <Button onClick={editingTransaction ? handleUpdateTransaction : handleAddTransaction} variant="contained">
            {editingTransaction ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={paymentDialogOpen} 
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Amount"
            type="number"
            fullWidth
            value={newPayment.amount}
            onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Date"
            type="date"
            fullWidth
            value={newPayment.date}
            onChange={(e) => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>From</InputLabel>
            <Select
              value={newPayment.fromMemberId}
              label="From"
              onChange={(e) => setNewPayment(prev => ({ ...prev, fromMemberId: e.target.value }))}
            >
              {group.members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>To</InputLabel>
            <Select
              value={newPayment.toMemberId}
              label="To"
              onChange={(e) => setNewPayment(prev => ({ ...prev, toMemberId: e.target.value }))}
            >
              {group.members
                .filter(member => member.id !== newPayment.fromMemberId)
                .map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Notes"
            fullWidth
            value={newPayment.notes}
            onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddPayment} variant="contained">
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={deleteDialogOpen}
        title={`Delete ${itemToDelete?.type === 'transaction' ? 'Transaction' : 'Member'}`}
        message={`Are you sure you want to delete this ${itemToDelete?.type}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default GroupDetails; 