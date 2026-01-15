import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, signOut, loading, updateDisplayName } = useAuth();
  const { syncDisplayName } = useApp();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEditNameOpen = () => {
    setNewDisplayName(user?.displayName || '');
    setEditNameOpen(true);
    handleMenuClose();
  };

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim()) return;
    setSaving(true);
    try {
      const trimmedName = newDisplayName.trim();
      await updateDisplayName(trimmedName);
      // Sync the display name to all groups where user is a member
      await syncDisplayName(trimmedName);
      setEditNameOpen(false);
    } catch (error) {
      console.error('Failed to update display name:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    handleMenuClose();
    signOut();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Split Transactions
          </Typography>
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body1" component="span" sx={{ mr: 1 }}>
                {user.displayName || user.email}
              </Typography>
              <IconButton
                color="inherit"
                onClick={handleMenuOpen}
                size="small"
              >
                <AccountCircleIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleEditNameOpen}>Edit Display Name</MenuItem>
                <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ flex: 1, py: 4 }}>
        {children || <Outlet />}
      </Container>

      <Dialog open={editNameOpen} onClose={() => setEditNameOpen(false)}>
        <DialogTitle>Edit Display Name</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Display Name"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            sx={{ mt: 1 }}
            helperText="This is how you'll appear to other group members"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditNameOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveDisplayName}
            variant="contained"
            disabled={saving || !newDisplayName.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Layout; 