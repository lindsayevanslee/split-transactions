import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import theme from './theme';
import GroupsList from './components/GroupsList';
import GroupDetails from './components/GroupDetails';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import AcceptInvitation from './components/AcceptInvitation';

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppProvider>
          <HashRouter>
            <Layout>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/accept-invite" element={<AcceptInvitation />} />
                <Route
                  path="/groups"
                  element={
                    <PrivateRoute>
                      <GroupsList />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/groups/:groupId"
                  element={
                    <PrivateRoute>
                      <GroupDetails />
                    </PrivateRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/groups" replace />} />
              </Routes>
            </Layout>
          </HashRouter>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
