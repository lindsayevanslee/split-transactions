import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Slider
} from '@mui/material';
import { Group, Transaction, Member } from '../types';
import { DEFAULT_CATEGORIES } from '../types';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (transaction: Omit<Transaction, 'id'>) => void;
  group: Group;
  transaction?: Transaction;
}

const TransactionForm = ({ open, onClose, onSubmit, group, transaction }: TransactionFormProps) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [payerId, setPayerId] = useState('');
  const [splits, setSplits] = useState<{ [key: string]: number }>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description);
      setAmount(transaction.amount.toString());
      setCategory(transaction.category);
      setPayerId(transaction.payerId);
      setSplits(transaction.splits.reduce((acc, split) => ({
        ...acc,
        [split.memberId]: split.percentage || 0
      }), {}));
      setNotes(transaction.notes || '');
    } else {
      setDescription('');
      setAmount('');
      setCategory('');
      setPayerId('');
      setSplits({});
      setNotes('');
    }
  }, [transaction]);

  const handleSplitChange = (memberId: string, value: number) => {
    setSplits(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleSubmit = () => {
    if (!description || !amount || !category || !payerId || Object.keys(splits).length === 0) {
      return;
    }

    const totalAmount = parseFloat(amount);
    const transactionSplits = Object.entries(splits).map(([memberId, percentage]) => ({
      memberId,
      amount: (percentage / 100) * totalAmount,
      percentage
    }));

    onSubmit({
      description,
      amount: totalAmount,
      category,
      payerId,
      splits: transactionSplits,
      date: new Date(),
      notes: notes
    });

    onClose();
  };

  const totalSplit = Object.values(splits).reduce((sum, value) => sum + value, 0);
  const isValid = totalSplit === 100;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{transaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              InputProps={{
                startAdornment: '$'
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth required>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                label="Category"
              >
                {[...DEFAULT_CATEGORIES, ...group.customCategories].map((cat) => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>Paid by</InputLabel>
              <Select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                label="Paid by"
              >
                {group.members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Split between members
            </Typography>
            {group.members.map((member) => (
              <Grid container spacing={2} key={member.id} alignItems="center">
                <Grid item xs={6}>
                  <Typography>{member.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Percentage"
                    value={splits[member.id] || 0}
                    onChange={(e) => {
                      const newSplits = { ...splits };
                      newSplits[member.id] = parseFloat(e.target.value) || 0;
                      setSplits(newSplits);
                    }}
                  />
                </Grid>
              </Grid>
            ))}
            <Typography color={isValid ? 'success.main' : 'error.main'}>
              Total: {totalSplit}%
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!isValid || !description || !amount || !category || !payerId}
        >
          {transaction ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionForm; 