import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
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
  Box,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const GroupsList = () => {
  const { groups, loading, error, createGroup, deleteGroup, isGroupOwner } = useApp();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const navigate = useNavigate();

  const handleCreateGroup = async () => {
    if (!user) return;

    try {
      const groupId = await createGroup({
        name: newGroupName,
        userId: user.uid,
        members: [{
          id: user.uid,
          name: user.displayName || user.email || 'Me',
          balance: 0,
          userId: user.uid,
          email: user.email || undefined,
          status: 'active',
          joinedAt: new Date(),
        }],
        transactions: [],
        payments: [],
        customCategories: []
      });

      setNewGroupName('');
      setOpen(false);
      navigate(`/groups/${groupId}`);
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  if (!user) {
    return (
      <Container>
        <Alert severity="info">Please sign in to view your groups.</Alert>
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

  return (
    <Container>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Your Groups
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Create New Group
        </Button>
      </Box>

      {groups.length === 0 ? (
        <Typography variant="body1" color="text.secondary">
          No groups yet. Create your first group to get started!
        </Typography>
      ) : (
        <List>
          {groups.map((group) => {
            const isOwner = isGroupOwner(group.id);
            return (
              <ListItem
                key={group.id}
                component="div"
                onClick={() => navigate(`/groups/${group.id}`)}
                sx={{
                  mb: 1,
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {group.name}
                      {isOwner ? (
                        <Chip label="Owner" size="small" color="primary" variant="outlined" />
                      ) : (
                        <Chip label="Member" size="small" variant="outlined" />
                      )}
                    </Box>
                  }
                  secondary={`${group.members.length} members • ${group.transactions.length} transactions`}
                />
                {isOwner && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(group.id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            );
          })}
        </List>
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
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
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateGroup} variant="contained" disabled={!newGroupName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GroupsList;
