import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Login from './Login';

const signIn = vi.fn();
const signUp = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ signIn, signUp, resetPassword: vi.fn() }),
}));

// Shows where Login navigated to and the state it passed along.
const Destination = () => {
  const location = useLocation();
  return (
    <div data-testid="destination">
      {location.pathname + location.search}|{JSON.stringify(location.state)}
    </div>
  );
};

function renderLogin(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'a@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
}

describe('Login', () => {
  beforeEach(() => {
    signIn.mockReset().mockResolvedValue(undefined);
    signUp.mockReset().mockResolvedValue(undefined);
  });

  it('goes to the groups list after sign in by default', async () => {
    renderLogin('/login');
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent('/groups|{"fromLogin":true}')
    );
  });

  it('opens on the sign-up form when signup=true', () => {
    renderLogin('/login?signup=true');
    expect(screen.getByRole('heading', { name: 'Create an Account' })).toBeInTheDocument();
  });

  it('returns to the invitation after creating an account from an invite', async () => {
    const redirect = encodeURIComponent('/accept-invite?token=abc123');
    renderLogin(`/login?redirect=${redirect}&signup=true`);
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent(
        '/accept-invite?token=abc123|{"fromLogin":true}'
      )
    );
    expect(signUp).toHaveBeenCalledWith('a@example.com', 'secret123', undefined);
  });

  it('returns to the invitation after signing in from an invite', async () => {
    const redirect = encodeURIComponent('/accept-invite?token=abc123');
    renderLogin(`/login?redirect=${redirect}`);
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent('/accept-invite?token=abc123')
    );
  });

  it('ignores redirects that point outside the app', async () => {
    renderLogin(`/login?redirect=${encodeURIComponent('//evil.example')}`);
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() =>
      expect(screen.getByTestId('destination')).toHaveTextContent('/groups|')
    );
  });
});
