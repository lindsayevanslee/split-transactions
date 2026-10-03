import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AcceptInvitation } from './AcceptInvitation';

const mockUser = { uid: 'user-1', displayName: 'New Person', email: 'new@example.com' };
let currentUser: typeof mockUser | null = mockUser;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: currentUser }),
}));

const getInvitationByToken = vi.fn();
const acceptInvitation = vi.fn();

vi.mock('../services/invitations', () => ({
  getInvitationByToken: (...args: unknown[]) => getInvitationByToken(...args),
  acceptInvitation: (...args: unknown[]) => acceptInvitation(...args),
}));

const pendingInvitation = {
  id: 'inv-1',
  groupId: 'group-1',
  groupName: 'Trip',
  memberId: 'member-1',
  invitedBy: 'owner-1',
  status: 'pending',
  token: 'abc123',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
};

function renderAccept(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/accept-invite', search: '?token=abc123', state }]}>
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvitation />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AcceptInvitation', () => {
  beforeEach(() => {
    currentUser = mockUser;
    getInvitationByToken.mockReset().mockResolvedValue(pendingInvitation);
    acceptInvitation.mockReset().mockResolvedValue({ groupId: 'group-1' });
  });

  it('accepts automatically after the user signs in from the invite', async () => {
    renderAccept({ fromLogin: true });

    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledTimes(1));
    expect(acceptInvitation).toHaveBeenCalledWith('inv-1', 'user-1', 'New Person', 'new@example.com');
    expect(await screen.findByText(/successfully joined/i)).toBeInTheDocument();
  });

  it('waits for a click when opened directly from a link', async () => {
    renderAccept();

    expect(await screen.findByRole('button', { name: 'Accept Invitation' })).toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('shows the error and keeps the accept button if auto-accept fails', async () => {
    acceptInvitation.mockRejectedValue(new Error('Invitation is no longer valid'));
    renderAccept({ fromLogin: true });

    expect(await screen.findByText('Invitation is no longer valid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept Invitation' })).toBeInTheDocument();
    expect(acceptInvitation).toHaveBeenCalledTimes(1);
  });

  it('asks a signed-out user to sign in, passing the invite as the redirect', async () => {
    currentUser = null;
    renderAccept();

    const createAccount = await screen.findByRole('link', { name: 'Create Account' });
    expect(createAccount.getAttribute('href')).toContain('signup=true');
    expect(createAccount.getAttribute('href')).toContain('redirect=');
    expect(acceptInvitation).not.toHaveBeenCalled();
  });
});
