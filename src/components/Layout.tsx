import { Outlet, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, Box, Button, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, signOut, loading } = useAuth();
  const location = useLocation();

  console.log('Current path:', location.pathname);
  console.log('Auth state:', { user, loading });

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
              <Typography variant="body1" component="span" sx={{ mr: 2 }}>
                {user.email}
              </Typography>
              <Button 
                color="inherit" 
                onClick={signOut}
                sx={{ textTransform: 'none' }}
              >
                Sign Out
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ flex: 1, py: 4 }}>
        {children || <Outlet />}
      </Container>
    </Box>
  );
};

export default Layout; 