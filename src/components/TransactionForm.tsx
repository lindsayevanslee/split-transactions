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
  Box,
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
  const [split, setSplit] = useState<{ [key: string]: number }>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (transaction) {
      setDescription(transaction.description);
      setAmount(transaction.amount.toString());
      setCategory(transaction.category);
      setPayerId(transaction.payerId);
      setSplit(transaction.split);
      setNotes(transaction.notes || '');
    } else {
      setDescription('');
      setAmount('');
      setCategory('');
      setPayerId('');
      setSplit({});
      setNotes('');
    }
  }, [transaction]);

  const handleSplitChange = (memberId: string, value: number) => {
    setSplit(prev => ({
      ...prev,
      [memberId]: value
    }));
  };

  const handleSubmit = () => {
    if (!description || !amount || !category || !payerId || Object.keys(split).length === 0) {
      return;
    }

    onSubmit({
      description,
      amount: parseFloat(amount),
      category,
      payerId,
      split,
      notes,
      date: new Date()
    });

    onClose();
  };

  const totalSplit = Object.values(split).reduce((sum, value) => sum + value, 0);
  const isValid = totalSplit === 100;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{transaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </Grid>
          <Grid xs={12} sm={6}>
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
          <Grid xs={12} sm={6}>
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
          <Grid xs={12}>
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
          <Grid xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Split between members
            </Typography>
            {group.members.map((member) => (
              <Box key={member.id} sx={{ mb: 2 }}>
                <Typography>{member.name}</Typography>
                <Slider
                  value={split[member.id] || 0}
                  onChange={(_, value) => handleSplitChange(member.id, value as number)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                  min={0}
                  max={100}
                  step={1}
                />
              </Box>
            ))}
            <Typography color={isValid ? 'success.main' : 'error.main'}>
              Total: {totalSplit}%
            </Typography>
          </Grid>
          <Grid xs={12}>
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