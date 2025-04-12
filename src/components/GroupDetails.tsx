import { useState, useEffect } from 'react';
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
  Container,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress,
  Alert,
  Tabs,
  Tab
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Add as AddIcon, Edit as EditIcon, People as PeopleIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Payment as PaymentIcon } from '@mui/icons-material';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_CATEGORIES, Transaction, Payment, Group, Member } from '../types';
import TransactionSummary from './TransactionSummary';
import MemberManagement from './MemberManagement';
import ConfirmationDialog from './ConfirmationDialog';
import TransactionForm from './TransactionForm';
import PaymentForm from './PaymentForm';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const GroupDetails = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups, loading, error, updateGroup } = useApp();
  const { user } = useAuth();
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
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    fromMemberId: '',
    toMemberId: '',
    notes: '',
  });
  const [group, setGroup] = useState<Group | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [open, setOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (groupId && groups.length > 0) {
      const foundGroup = groups.find(g => g.id === groupId);
      if (foundGroup) {
        setGroup(foundGroup);
      } else {
        navigate('/groups');
      }
    }
  }, [groupId, groups, navigate]);

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

    updateGroup(groupId!, updatedGroup);
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
      updateGroup(groupId!, updatedGroup);
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
      let splits;
      
      if (newTransaction.splitType === 'even') {
        splits = group.members.map(member => ({
          memberId: member.id,
          amount: amount / group.members.length,
        }));
      } else {
        // For custom splits, calculate amounts based on the split method
        splits = newTransaction.splits.map(split => {
          if (newTransaction.splitMethod === 'percentage') {
            // Calculate amount from percentage
            return {
              memberId: split.memberId,
              amount: (split.percentage || 0) / 100 * amount,
              percentage: split.percentage
            };
          } else {
            // Use the direct amount
            return {
              memberId: split.memberId,
              amount: split.amount
            };
          }
        });
      }

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
      updateGroup(groupId!, updatedGroup);
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
    console.log('Attempting to add payment:', newPayment);
    if (newPayment.amount && newPayment.fromMemberId && newPayment.toMemberId) {
      const updatedGroup = {
        ...group,
        payments: [
          ...(group.payments || []),
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
      console.log('Updating group with new payment:', updatedGroup);
      updateGroup(groupId!, updatedGroup);
      setPaymentDialogOpen(false);
      setNewPayment({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        fromMemberId: '',
        toMemberId: '',
        notes: '',
      });
    } else {
      console.log('Missing required payment fields:', {
        amount: newPayment.amount,
        fromMemberId: newPayment.fromMemberId,
        toMemberId: newPayment.toMemberId
      });
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    const updatedGroup = {
      ...group,
      payments: group.payments.filter(p => p.id !== paymentId),
    };
    updateGroup(groupId!, updatedGroup);
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setNewPayment({
      amount: payment.amount.toString(),
      date: new Date(payment.date).toISOString().split('T')[0],
      fromMemberId: payment.fromMemberId,
      toMemberId: payment.toMemberId,
      notes: payment.notes,
    });
    setPaymentDialogOpen(true);
  };

  const handleUpdatePayment = () => {
    if (newPayment.amount && newPayment.fromMemberId && newPayment.toMemberId && editingPayment) {
      const updatedGroup = {
        ...group,
        payments: group.payments.map(payment =>
          payment.id === editingPayment.id
            ? {
                ...payment,
                amount: parseFloat(newPayment.amount),
                date: new Date(newPayment.date),
                fromMemberId: newPayment.fromMemberId,
                toMemberId: newPayment.toMemberId,
                notes: newPayment.notes,
              }
            : payment
        ),
      };
      updateGroup(groupId!, updatedGroup);
      setPaymentDialogOpen(false);
      setEditingPayment(null);
      setNewPayment({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        fromMemberId: '',
        toMemberId: '',
        notes: '',
      });
    }
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim() || !group) return;

    try {
      const updatedGroup: Group = {
        ...group,
        members: [...group.members, { id: crypto.randomUUID(), name: newMemberName.trim() }]
      };
      await updateGroup(groupId!, updatedGroup);
      setNewMemberName('');
      setOpen(false);
    } catch (err) {
      console.error('Error adding member:', err);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!group) return;

    try {
      const updatedGroup: Group = {
        ...group,
        members: group.members.filter((m: Member) => m.id !== memberId)
      };
      await updateGroup(groupId!, updatedGroup);
    } catch (err) {
      console.error('Error deleting member:', err);
    }
  };

  if (!user) {
    return (
      <Container>
        <Alert severity="info">Please sign in to view group details.</Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!group) {
    return null;
  }

  const getMemberName = (id: string): string => {
    const member = group.members.find(m => m.id === id);
    return member?.name || 'Unknown';
  };

  return (
    <Container>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {group.name}
        </Typography>
        <Button variant="contained" onClick={() => setMemberDialogOpen(true)}>
          Add Member
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Summary" />
          <Tab label="Transactions" />
          <Tab label="Payments" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Members
              </Typography>
              <List>
                {group.members.map((member) => (
                  <ListItem
                    key={member.id}
                    sx={{ mb: 1, borderRadius: 1, bgcolor: 'background.paper' }}
                  >
                    <ListItemText primary={member.name} />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDeleteMember(member.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <TransactionSummary group={group} />
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setTransactionDialogOpen(true)}
          >
            Add Transaction
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Paid by</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {group.transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                  <TableCell>{getMemberName(transaction.payerId)}</TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingTransaction(transaction);
                        setTransactionDialogOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick('transaction', transaction.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setPaymentDialogOpen(true)}
          >
            Add Payment
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {group.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                  <TableCell>{getMemberName(payment.fromId)}</TableCell>
                  <TableCell>{getMemberName(payment.toId)}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{payment.notes}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingPayment(payment);
                        setPaymentDialogOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeletePayment(payment.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <Dialog open={memberDialogOpen} onClose={() => setMemberDialogOpen(false)}>
        <DialogTitle>Add New Member</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Member Name"
            fullWidth
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddMember} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <TransactionForm
        open={transactionDialogOpen}
        onClose={() => {
          setTransactionDialogOpen(false);
          setEditingTransaction(null);
        }}
        onSubmit={editingTransaction ? handleUpdateTransaction : handleAddTransaction}
        group={group}
        transaction={editingTransaction || undefined}
      />

      <PaymentForm
        open={paymentDialogOpen}
        onClose={() => {
          setPaymentDialogOpen(false);
          setEditingPayment(null);
        }}
        onSubmit={editingPayment ? handleUpdatePayment : handleAddPayment}
        group={group}
        payment={editingPayment || undefined}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        title={`Delete ${itemToDelete?.type === 'transaction' ? 'Transaction' : 'Member'}`}
        message={`Are you sure you want to delete this ${itemToDelete?.type}? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Add New Member</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Member Name"
            fullWidth
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAddMember} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GroupDetails; 