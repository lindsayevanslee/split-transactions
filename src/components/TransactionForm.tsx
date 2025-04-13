import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useState } from 'react';
import { Group, Transaction } from '../types';

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (transaction: Omit<Transaction, 'id'>) => void;
  group: Group;
  transaction?: Transaction;
}

const TransactionForm = ({ open, onClose, onSubmit, group, transaction }: TransactionFormProps) => {
  const [description, setDescription] = useState(transaction?.description || '');
  const [amount, setAmount] = useState(transaction?.amount.toString() || '');
  const [category, setCategory] = useState(transaction?.category || '');
  const [payerId, setPayerId] = useState(transaction?.payerId || '');
  const [splits, setSplits] = useState<Record<string, number>>(
    transaction?.splits.reduce((acc, split) => ({
      ...acc,
      [split.memberId]: split.percentage
    }), {}) || {}
  );
  const [notes, setNotes] = useState(transaction?.notes || '');

  const handleSubmit = () => {
    if (!isValid) return;

    const transactionSplits = Object.entries(splits).map(([memberId, percentage]) => ({
      memberId,
      amount: (percentage / 100) * parseFloat(amount),
      percentage
    }));

    onSubmit({
      description,
      amount: parseFloat(amount),
      category,
      payerId,
      splits: transactionSplits,
      notes,
      date: new Date(),
    });
    onClose();
  };

  const handleSplitChange = (memberId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSplits(prev => ({
      ...prev,
      [memberId]: numValue
    }));
  };

  const totalSplit = Object.values(splits).reduce((sum, value) => sum + value, 0);
  const isValid = 
    description.trim() !== '' && 
    !isNaN(parseFloat(amount)) && 
    parseFloat(amount) > 0 && 
    category.trim() !== '' && 
    payerId !== '' && 
    totalSplit === 100;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Transaction</DialogTitle>
      <DialogContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            error={description.trim() === ''}
            helperText={description.trim() === '' ? 'Description is required' : ''}
          />
          <div style={{ display: 'flex', gap: '16px' }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              error={isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
              helperText={isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 ? 'Amount must be greater than 0' : ''}
            />
            <TextField
              fullWidth
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              error={category.trim() === ''}
              helperText={category.trim() === '' ? 'Category is required' : ''}
            />
          </div>
          <FormControl fullWidth required error={payerId === ''}>
            <InputLabel>Payer</InputLabel>
            <Select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              label="Payer"
            >
              {group.members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <div>
            <Typography variant="subtitle1" gutterBottom>
              Split Among Members
            </Typography>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {group.members.map((member) => (
                <TextField
                  key={member.id}
                  fullWidth
                  label={member.name}
                  type="number"
                  value={splits[member.id] || ''}
                  onChange={(e) => handleSplitChange(member.id, e.target.value)}
                  error={totalSplit !== 100}
                />
              ))}
            </div>
            <Typography color={totalSplit === 100 ? 'success.main' : 'error.main'}>
              Total: {totalSplit}%
            </Typography>
          </div>
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={!isValid}
        >
          Add Transaction
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionForm; 