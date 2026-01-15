import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getInvitationByToken, acceptInvitation } from '../services/invitations';
import { Invitation } from '../types';

export const AcceptInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const inv = await getInvitationByToken(token);
        if (!inv) {
          setError('Invitation not found or has expired');
        } else if (inv.status !== 'pending') {
          setError(`This invitation has already been ${inv.status}`);
        } else if (new Date() > inv.expiresAt) {
          setError('This invitation has expired');
        } else {
          setInvitation(inv);
        }
      } catch (err) {
        console.error('Error fetching invitation:', err);
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!invitation || !user) return;

    setAccepting(true);
    setError(null);

    try {
      const { groupId } = await acceptInvitation(
        invitation.id,
        user.uid,
        user.displayName || undefined,
        user.email || undefined
      );
      setSuccess(true);
      // Redirect to the group after a short delay
      setTimeout(() => {
        navigate(`/groups/${groupId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading invitation...</Typography>
        </Paper>
      </Container>
    );
  }

  if (error && !invitation) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button component={RouterLink} to="/" variant="contained">
            Go to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            You have successfully joined the group!
          </Alert>
          <Typography>Redirecting to the group...</Typography>
          <CircularProgress sx={{ mt: 2 }} />
        </Paper>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Join "{invitation?.groupName}"
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            You've been invited to join this group. Please sign in or create an account to accept the invitation.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              component={RouterLink}
              to={`/login?redirect=${encodeURIComponent(window.location.hash.substring(1))}`}
              variant="contained"
            >
              Sign In
            </Button>
            <Button
              component={RouterLink}
              to={`/login?redirect=${encodeURIComponent(window.location.hash.substring(1))}&signup=true`}
              variant="outlined"
            >
              Create Account
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Join "{invitation?.groupName}"
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          You've been invited to join this expense sharing group. Click below to accept.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? <CircularProgress size={24} /> : 'Accept Invitation'}
          </Button>
          <Button
            component={RouterLink}
            to="/"
            variant="outlined"
            disabled={accepting}
          >
            Decline
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AcceptInvitation;
