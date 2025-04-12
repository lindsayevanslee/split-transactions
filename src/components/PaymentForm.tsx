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
  MenuItem
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

  const handleSubmit = () => {
    if (!amount || !fromId || !toId) {
      return;
    }

    onSubmit({
      amount: parseFloat(amount),
      fromId,
      toId,
      date: new Date(),
      notes
    });

    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{payment ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
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
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>From</InputLabel>
              <Select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                label="From"
              >
                {group.members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>To</InputLabel>
              <Select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                label="To"
              >
                {group.members.map((member) => (
                  <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
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
          disabled={!amount || !fromId || !toId}
        >
          {payment ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PaymentForm; 