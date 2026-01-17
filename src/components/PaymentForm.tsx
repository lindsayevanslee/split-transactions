import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Stack
} from '@mui/material';
import { Group, Payment } from '../types';

interface PaymentFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payment: Omit<Payment, 'id'>) => void;
  group: Group;
  payment?: Payment;
}

const PaymentForm = ({ open, onClose, onSubmit, group, payment }: PaymentFormProps) => {
  const [amount, setAmount] = useState('');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount.toString());
      setFromId(payment.fromId);
      setToId(payment.toId);
      setNotes(payment.notes || '');
    } else {
      setAmount('');
      setFromId('');
      setToId('');
      setNotes('');
    }
  }, [payment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      amount: parseFloat(amount),
      fromId,
      toId,
      notes,
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{payment ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
          />
          <FormControl fullWidth>
            <InputLabel>From</InputLabel>
            <Select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              label="From"
            >
              {group.members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>To</InputLabel>
            <Select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              label="To"
            >
              {group.members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={!amount || !fromId || !toId}
        >
          {payment ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentForm; 