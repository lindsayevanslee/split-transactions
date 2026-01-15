import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  IconButton,
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
  Tab,
  Chip,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Link as LinkIcon } from '@mui/icons-material';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Transaction, Payment, Group, Member } from '../types';
import TransactionSummary from './TransactionSummary';
import ConfirmationDialog from './ConfirmationDialog';
import TransactionForm from './TransactionForm';
import PaymentForm from './PaymentForm';
import InviteMemberDialog from './InviteMemberDialog';
import { createInvitation } from '../services/invitations';

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
  const { groups, loading, error, updateGroup, isGroupOwner, canManageMembers } = useApp();
  const { user } = useAuth();
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'transaction' | 'member'; id: string } | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const isOwner = groupId ? isGroupOwner(groupId) : false;
  const canManage = groupId ? canManageMembers(groupId) : false;

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

  const handleUpdateGroupWithMember = async (updatedGroup: Group) => {
    if (!groupId) return;
    await updateGroup(groupId, updatedGroup);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!group || !canManage) return;

    try {
      const updatedGroup: Group = {
        ...group,
        members: group.members.filter((m: Member) => m.id !== memberId),
        // Also remove from memberUserIds if they had an account linked
        memberUserIds: group.memberUserIds.filter(uid => {
          const member = group.members.find(m => m.id === memberId);
          return uid !== member?.userId;
        }),
      };
      await updateGroup(groupId!, updatedGroup);
    } catch (err) {
      console.error('Error deleting member:', err);
    }
  };

  const handleGenerateInviteLink = async (member: Member) => {
    if (!group || !user || !canManage) return;

    try {
      const { inviteLink } = await createInvitation(
        group.id,
        group.name,
        member.id,
        user.uid
      );

      // Update member status to invited
      const updatedMembers = group.members.map(m =>
        m.id === member.id ? { ...m, status: 'invited' as const } : m
      );
      await updateGroup(group.id, { ...group, members: updatedMembers });

      // Copy to clipboard
      await navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard!');
    } catch (err) {
      console.error('Error generating invite link:', err);
    }
  };

  const handleUpdatePayment = (payment: Omit<Payment, 'id'>) => {
    if (!group || !groupId || !editingPayment) return;

    const updatedGroup: Group = {
      ...group,
      payments: group.payments.map(p =>
        p.id === editingPayment.id
          ? {
              ...payment,
              id: editingPayment.id,
              date: new Date(payment.date),
            }
          : p
      ),
      updatedAt: new Date(),
    };
    updateGroup(groupId, updatedGroup);
    setPaymentDialogOpen(false);
    setEditingPayment(null);
  };

  const getMemberStatusChip = (member: Member) => {
    switch (member.status) {
      case 'active':
        return <Chip label="Active" size="small" color="success" variant="outlined" />;
      case 'invited':
        return <Chip label="Invited" size="small" color="warning" variant="outlined" />;
      case 'placeholder':
      default:
        return <Chip label="Placeholder" size="small" variant="outlined" />;
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1">
            {group.name}
          </Typography>
          {isOwner ? (
            <Chip label="Owner" size="small" color="primary" />
          ) : (
            <Chip label="Member" size="small" variant="outlined" />
          )}
        </Box>
        {canManage && (
          <Button variant="contained" onClick={() => setMemberDialogOpen(true)}>
            Add Member
          </Button>
        )}
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
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {member.name}
                          {getMemberStatusChip(member)}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      {canManage && member.status === 'placeholder' && (
                        <Tooltip title="Generate invite link">
                          <IconButton
                            edge="end"
                            aria-label="invite"
                            onClick={() => handleGenerateInviteLink(member)}
                            sx={{ mr: 1 }}
                          >
                            <LinkIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canManage && member.userId !== user?.uid && (
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleDeleteMember(member.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
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
                      {transaction.splitType && (
                        <Chip
                          label={transaction.splitType === 'percentage' ? '%' : transaction.splitType}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
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

      <InviteMemberDialog
        open={memberDialogOpen}
        onClose={() => setMemberDialogOpen(false)}
        group={group}
        onUpdateGroup={handleUpdateGroupWithMember}
        userId={user?.uid || ''}
      />

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
    </Container>
  );
};

export default GroupDetails;
