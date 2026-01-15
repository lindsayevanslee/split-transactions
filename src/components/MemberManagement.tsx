import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useState } from 'react';
import { Group, Member } from '../types';
import ConfirmationDialog from './ConfirmationDialog';

interface MemberManagementProps {
  group: Group;
  open: boolean;
  onClose: () => void;
  onUpdateGroup: (updatedGroup: Group) => void;
  onDeleteMember: (memberId: string) => void;
}

const MemberManagement = ({ group, open, onClose, onUpdateGroup, onDeleteMember }: MemberManagementProps) => {
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  const handleAddMember = async () => {
    if (!group || !newMemberName.trim()) return;

    const newMember: Member = {
      id: crypto.randomUUID(),
      name: newMemberName.trim(),
      balance: 0,
      status: 'placeholder',
    };

    const updatedGroup: Group = {
      ...group,
      members: [...group.members, newMember]
    };

    onUpdateGroup(updatedGroup);
    setNewMemberName('');
    onClose();
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setNewMemberName(member.name);
  };

  const handleUpdateMember = () => {
    if (editingMember && newMemberName.trim()) {
      const updatedGroup = {
        ...group,
        members: group.members.map(member =>
          member.id === editingMember.id
            ? { ...member, name: newMemberName.trim() }
            : member
        ),
      };
      onUpdateGroup(updatedGroup);
      setEditingMember(null);
      setNewMemberName('');
      setError(null);
    }
  };

  const handleDeleteClick = (memberId: string) => {
    // Check if member is involved in any transactions
    const isPayer = group.transactions.some(t => t.payerId === memberId);
    const isInvolvedInSplits = group.transactions.some(t => 
      t.splits.some(s => s.memberId === memberId)
    );

    if (isPayer || isInvolvedInSplits) {
      setError('Cannot delete member who is involved in transactions');
      return;
    }

    setMemberToDelete(memberId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (memberToDelete) {
      onDeleteMember(memberToDelete);
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setMemberToDelete(null);
  };

  const getMemberStats = (memberId: string) => {
    const paidTransactions = group.transactions.filter(t => t.payerId === memberId);
    const totalPaid = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const receivedTransactions = group.transactions.filter(t => 
      t.splits.some(s => s.memberId === memberId)
    );
    const totalReceived = receivedTransactions.reduce((sum, t) => 
      sum + (t.splits.find(s => s.memberId === memberId)?.amount || 0), 0
    );

    return {
      paid: totalPaid,
      received: totalReceived,
      net: totalPaid - totalReceived,
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Members</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Add New Member
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Member Name"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={editingMember ? handleUpdateMember : handleAddMember}
              disabled={!newMemberName.trim()}
            >
              {editingMember ? 'Update' : 'Add'}
            </Button>
          </Box>
        </Box>

        <Typography variant="subtitle1" gutterBottom>
          Current Members
        </Typography>
        <List>
          {group.members.map((member) => {
            const stats = getMemberStats(member.id);
            return (
              <ListItem key={member.id}>
                <ListItemText
                  primary={member.name}
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      Paid: {formatCurrency(stats.paid)} • Received: {formatCurrency(stats.received)} • Net: {formatCurrency(stats.net)}
                    </Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    onClick={() => handleEditMember(member)}
                    sx={{ mr: 1 }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteClick(member.id)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
          {group.members.length === 0 && (
            <ListItem>
              <ListItemText primary="No members yet" />
            </ListItem>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      <ConfirmationDialog
        open={deleteDialogOpen}
        title="Delete Member"
        message="Are you sure you want to delete this member? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Dialog>
  );
};

export default MemberManagement; 