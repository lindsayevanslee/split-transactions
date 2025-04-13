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
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Transaction, Payment, Group, Member } from '../types';
import TransactionSummary from './TransactionSummary';
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
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'transaction' | 'member'; id: string } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
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

  const handleDeleteConfirm = () => {
    if (!group || !groupId) return;

    const updatedGroup: Group = {
      ...group,
      transactions: group.transactions.filter(t => t.id !== itemToDelete?.id),
      updatedAt: new Date(),
    };
    updateGroup(groupId, updatedGroup);
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleUpdateTransaction = (transaction: Omit<Transaction, 'id'>) => {
    if (!group || !groupId || !editingTransaction) return;

    const updatedGroup: Group = {
      ...group,
      transactions: group.transactions.map(t =>
        t.id === editingTransaction.id
          ? {
              ...transaction,
              id: editingTransaction.id,
              date: new Date(transaction.date),
            }
          : t
      ),
      updatedAt: new Date(),
    };
    updateGroup(groupId, updatedGroup);
    setTransactionDialogOpen(false);
    setEditingTransaction(undefined);
  };

  const handleAddTransaction = (transaction: Omit<Transaction, 'id'>) => {
    if (!group || !groupId) return;

    const updatedGroup: Group = {
      ...group,
      transactions: [
        ...group.transactions,
        {
          ...transaction,
          id: crypto.randomUUID(),
          date: new Date(transaction.date),
        },
      ],
      updatedAt: new Date(),
    };
    updateGroup(groupId, updatedGroup);
    setTransactionDialogOpen(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleAddPayment = (payment: Omit<Payment, 'id'>) => {
    if (!group || !groupId) return;

    const updatedGroup: Group = {
      ...group,
      payments: [
        ...group.payments,
        {
          ...payment,
          id: crypto.randomUUID(),
          date: new Date(payment.date),
          fromId: payment.fromId,
          toId: payment.toId,
        },
      ],
      updatedAt: new Date(),
    };
    updateGroup(groupId, updatedGroup);
    setPaymentDialogOpen(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!group || !groupId) return;
    
    const updatedGroup = {
      ...group,
      payments: group.payments.filter(p => p.id !== paymentId)
    };
    
    await updateGroup(groupId, updatedGroup);
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

  const handleUpdatePayment = (payment: Omit<Payment, 'id'>) => {
    if (!group || !groupId || !editingPayment) return;

    const updatedGroup: Group = {
      id: group.id,
      name: group.name,
      userId: group.userId,
      members: group.members,
      transactions: group.transactions,
      payments: group.payments.map(p =>
        p.id === editingPayment.id
          ? {
              ...payment,
              id: editingPayment.id,
              date: new Date(payment.date),
            }
          : p
      ),
      customCategories: group.customCategories,
      createdAt: group.createdAt,
      updatedAt: new Date(),
    };
    updateGroup(groupId, updatedGroup);
    setPaymentDialogOpen(false);
    setEditingPayment(null);
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Box>
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
          </Box>

          <Box>
            <TransactionSummary group={group} />
          </Box>
        </Box>
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

        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Transactions</Typography>
          <Box sx={{ display: 'grid', gap: 2 }}>
            {group.transactions.map((transaction) => (
              <Paper key={transaction.id} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">{transaction.description}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(transaction.date).toLocaleDateString()} - {formatCurrency(transaction.amount)}
                    </Typography>
                  </Box>
                  <Box>
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
                      onClick={() => {
                        setItemToDelete({ type: 'transaction', id: transaction.id });
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
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
          setEditingTransaction(undefined);
        }}
        onSubmit={editingTransaction ? handleUpdateTransaction : handleAddTransaction}
        group={group}
        transaction={editingTransaction}
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