import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Box,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useApp } from '../context/AppContext';
import ConfirmationDialog from './ConfirmationDialog';

const GroupsList = () => {
  const navigate = useNavigate();
  const { groups, addGroup, deleteGroup } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      addGroup({
        id: crypto.randomUUID(),
        name: newGroupName.trim(),
        members: [],
        transactions: [],
        customCategories: [],
      });
      setNewGroupName('');
      setDialogOpen(false);
    }
  };

  const handleDeleteClick = (groupId: string) => {
    setGroupToDelete(groupId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (groupToDelete) {
      deleteGroup(groupToDelete);
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setGroupToDelete(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getGroupStats = (group: typeof groups[0]) => {
    const totalAmount = group.transactions.reduce((sum, t) => sum + t.amount, 0);
    
    const dates = group.transactions.map(t => new Date(t.date));
    const dateRange = dates.length > 0
      ? `${dates[0].toLocaleDateString()} - ${dates[dates.length - 1].toLocaleDateString()}`
      : 'No transactions';

    return {
      totalAmount,
      dateRange,
      memberCount: group.members.length,
      transactionCount: group.transactions.length,
    };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <Typography variant="h4" component="h1">
          Your Groups
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Create New Group
        </Button>
      </div>

      <Paper sx={{ p: 2 }}>
        <List>
          {groups.map((group) => {
            const stats = getGroupStats(group);
            return (
              <ListItem
                key={group.id}
                button
                onClick={() => navigate(`/group/${group.id}`)}
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <ListItemText
                  primary={group.name}
                  secondary={
                    <Box>
                      <Typography component="span" variant="body2" color="text.secondary">
                        {stats.memberCount} {stats.memberCount === 1 ? 'member' : 'members'} • {stats.transactionCount} {stats.transactionCount === 1 ? 'transaction' : 'transactions'}
                      </Typography>
                      <Typography component="span" variant="body2" color="text.secondary" display="block">
                        {formatCurrency(stats.totalAmount)} in transactions
                      </Typography>
                      <Typography component="span" variant="body2" color="text.secondary" display="block">
                        {stats.dateRange}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(group.id);
                    }}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            );
          })}
          {groups.length === 0 && (
            <ListItem>
              <ListItemText primary="No groups yet" />
            </ListItem>
          )}
        </List>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Group Name"
            fullWidth
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddGroup} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={deleteDialogOpen}
        title="Delete Group"
        message="Are you sure you want to delete this group? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default GroupsList; 