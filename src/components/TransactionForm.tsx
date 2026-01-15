import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';
import { useState, useEffect } from 'react';
import { Group, Transaction, SplitType } from '../types';
import { SplitTypeSelector } from './SplitTypeSelector';
import { SplitInput, calculateSplits, validateSplits, getDefaultSplitInputs } from '../utils/splitCalculator';

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
  const [notes, setNotes] = useState(transaction?.notes || '');
  const [splitType, setSplitType] = useState<SplitType>(transaction?.splitType || 'equal');
  const [splitInputs, setSplitInputs] = useState<SplitInput[]>([]);

  // Initialize all form fields when dialog opens
  useEffect(() => {
    if (open) {
      if (transaction) {
        // Edit mode: populate form with transaction data
        setDescription(transaction.description);
        setAmount(transaction.amount.toString());
        setCategory(transaction.category);
        setPayerId(transaction.payerId);
        setNotes(transaction.notes || '');
        setSplitType(transaction.splitType);

        // Reconstruct split inputs from existing splits
        const inputs: SplitInput[] = group.members.map(member => {
          const existingSplit = transaction.splits.find(s => s.memberId === member.id);
          if (transaction.splitType === 'equal') {
            return {
              memberId: member.id,
              value: 0,
              included: existingSplit ? existingSplit.amount > 0 : true,
            };
          } else if (transaction.splitType === 'percentage') {
            return {
              memberId: member.id,
              value: existingSplit?.percentage || 0,
            };
          } else if (transaction.splitType === 'shares') {
            return {
              memberId: member.id,
              value: existingSplit?.shares ?? 1,
            };
          } else {
            // exact
            return {
              memberId: member.id,
              value: existingSplit?.amount || 0,
            };
          }
        });
        setSplitInputs(inputs);
      } else {
        // New transaction: reset form to defaults
        setDescription('');
        setAmount('');
        setCategory('');
        setPayerId('');
        setNotes('');
        setSplitType('equal');
        setSplitInputs(getDefaultSplitInputs(group.members.map(m => m.id), 'equal'));
      }
    }
  }, [open, group.members, transaction]);

  // Update split inputs when split type changes (for new transactions only)
  useEffect(() => {
    if (open && !transaction) {
      setSplitInputs(getDefaultSplitInputs(group.members.map(m => m.id), splitType));
    }
  }, [splitType, open, transaction, group.members]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    const calculatedSplits = calculateSplits(numericAmount, splitType, splitInputs);

    onSubmit({
      description,
      amount: numericAmount,
      category,
      payerId,
      splitType,
      splits: calculatedSplits,
      notes,
      date: transaction?.date || new Date(),
      createdAt: transaction?.createdAt || new Date(),
      updatedAt: new Date()
    });
    onClose();
  };

  const handleClose = () => {
    // Reset form
    setDescription('');
    setAmount('');
    setCategory('');
    setPayerId('');
    setNotes('');
    setSplitType('equal');
    setSplitInputs([]);
    onClose();
  };

  const numericAmount = parseFloat(amount) || 0;
  const splitValidation = validateSplits(numericAmount, splitType, splitInputs);

  const isValid =
    description.trim() !== '' &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    category.trim() !== '' &&
    payerId !== '' &&
    splitValidation.valid;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{transaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            error={description.trim() === ''}
            helperText={description.trim() === '' ? 'Description is required' : ''}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              error={isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
              helperText={isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 ? 'Amount must be greater than 0' : ''}
              inputProps={{ min: 0, step: 0.01 }}
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
          </Box>
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

          <SplitTypeSelector
            splitType={splitType}
            onSplitTypeChange={setSplitType}
            members={group.members}
            splitInputs={splitInputs}
            onSplitInputsChange={setSplitInputs}
            totalAmount={numericAmount}
          />

          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!isValid}
        >
          {transaction ? 'Save Changes' : 'Add Transaction'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionForm;
