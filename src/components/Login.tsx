import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { AuthError } from 'firebase/auth';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

// Load reCAPTCHA script dynamically
const loadRecaptchaScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!RECAPTCHA_SITE_KEY) {
      resolve(); // Skip if no site key configured
      return;
    }
    if (document.querySelector('script[src*="recaptcha"]')) {
      resolve(); // Already loaded
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(script);
  });
};

// Execute reCAPTCHA and get token
const executeRecaptcha = async (action: string): Promise<string | null> => {
  if (!RECAPTCHA_SITE_KEY) {
    return null; // Skip if no site key configured
  }
  try {
    return await new Promise((resolve) => {
      grecaptcha.ready(async () => {
        const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
        resolve(token);
      });
    });
  } catch {
    console.warn('reCAPTCHA execution failed');
    return null;
  }
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword } = useAuth();

  // Load reCAPTCHA script on mount
  useEffect(() => {
    loadRecaptchaScript().catch((err) => {
      console.warn('Failed to load reCAPTCHA:', err);
    });
  }, []);

  const getErrorMessage = (error: AuthError): string => {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please sign in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/Password authentication is not enabled. Please contact support.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      default:
        return error.message || 'An error occurred. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Execute reCAPTCHA before sign in
      await executeRecaptcha('login');

      await signIn(email, password);
      navigate('/groups');
    } catch (err) {
      console.error('Sign in error:', err);
      if (err && typeof err === 'object' && 'code' in err) {
        setError(getErrorMessage(err as AuthError));
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Execute reCAPTCHA before sign up
      await executeRecaptcha('signup');

      await signUp(email, password, displayName.trim() || undefined);
      navigate('/groups');
    } catch (err) {
      console.error('Sign up error:', err);
      if (err && typeof err === 'object' && 'code' in err) {
        setError(getErrorMessage(err as AuthError));
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setResetEmail(email); // Pre-fill with email from login form
    setResetDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Execute reCAPTCHA before password reset
      await executeRecaptcha('reset_password');

      await resetPassword(resetEmail);
      setResetDialogOpen(false);
      setSuccess('Password reset email sent! Check your inbox (and spam folder).');
    } catch (err) {
      console.error('Reset password error:', err);
      if (err && typeof err === 'object' && 'code' in err) {
        const authError = err as AuthError;
        if (authError.code === 'auth/user-not-found') {
          setError('No account found with this email address.');
        } else {
          setError(getErrorMessage(authError));
        }
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography component="h1" variant="h5">
            {isSignUp ? 'Create an Account' : 'Sign in to Ledgr'}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 2, width: '100%' }}>
              {success}
            </Alert>
          )}
          <Box component="form" onSubmit={isSignUp ? handleSignUp : handleSubmit} sx={{ mt: 1, width: '100%' }}>
            {isSignUp && (
              <TextField
                margin="normal"
                fullWidth
                id="displayName"
                label="Display Name"
                name="displayName"
                autoComplete="name"
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                helperText="This is how you'll appear to other group members"
              />
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus={!isSignUp}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!isSignUp && (
              <Box sx={{ textAlign: 'right', mt: 1 }}>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={handleForgotPassword}
                  sx={{ cursor: 'pointer' }}
                >
                  Forgot password?
                </Link>
              </Box>
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 2, mb: 2 }}
              disabled={isLoading}
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccess('');
              }}
              disabled={isLoading}
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Create an Account'}
            </Button>
          </Box>
        </Paper>
      </Box>

      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter your email address and we'll send you a link to reset your password.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Email Address"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleResetPassword}
            variant="contained"
            disabled={isLoading || !resetEmail.trim()}
          >
            Send Reset Email
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Login;
