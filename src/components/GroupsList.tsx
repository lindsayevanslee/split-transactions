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
  Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Group } from '../types';

const GroupsList = () => {
  const navigate = useNavigate();
  const { groups, loading, error, createGroup, deleteGroup } = useApp();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    try {
      await createGroup({
        name: newGroupName.trim(),
        members: [],
        transactions: [],
        payments: [],
        customCategories: []
      });
      setNewGroupName('');
      setOpen(false);
    } catch (err) {
      console.error('Error creating group:', err);
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
          {groups.map((group) => (
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
                primary={group.name}
                secondary={`${group.members.length} members • ${group.transactions.length} transactions`}
              />
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
            </ListItem>
          ))}
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
          <Button onClick={handleCreateGroup} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GroupsList; 