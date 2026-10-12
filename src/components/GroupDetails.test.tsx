import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GroupDetails from './GroupDetails';
import { Group } from '../types';

const group: Group = {
  id: 'g1', name: 'Lake weekend', userId: 'owner', memberUserIds: ['owner'],
  members: [
    { id: 'm1', name: 'Alice', balance: 0, status: 'active', userId: 'owner' },
    { id: 'm2', name: 'Bob', balance: 0, status: 'placeholder' },
  ],
  transactions: [], payments: [], customCategories: [],
  createdAt: new Date(), updatedAt: new Date(),
};

let canManage = true;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'owner' } }),
}));
vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    groups: [group],
    loading: false,
    error: null,
    updateGroup: vi.fn(),
    isGroupOwner: () => canManage,
    canManageMembers: () => canManage,
  }),
}));
vi.mock('../services/invitations', () => ({
  createInvitation: vi.fn(),
  cancelMemberInvitations: vi.fn(),
}));

const renderGroup = () => render(
  <MemoryRouter initialEntries={['/groups/g1']}>
    <Routes>
      <Route path="/groups/:groupId" element={<GroupDetails />} />
    </Routes>
  </MemoryRouter>
);

describe('GroupDetails tabs', () => {
  beforeEach(() => {
    canManage = true;
  });

  it('shows only the summary sections on the Summary tab', () => {
    renderGroup();
    const panel = screen.getByRole('tabpanel');
    // Three sections, each a heading over its own box
    for (const name of ['Settlements Due', 'Ledger Balances', 'Checks']) {
      expect(within(panel).getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(within(panel).queryByText('Account Summary')).not.toBeInTheDocument();
    expect(within(panel).queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
  });

  it('lists members and the Add Member button on the Members tab', () => {
    renderGroup();
    fireEvent.click(screen.getByRole('tab', { name: 'Members' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { name: 'Members' })).toBeInTheDocument();
    expect(within(panel).getByText('Alice')).toBeInTheDocument();
    expect(within(panel).getByText('Bob')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /add member/i })).toBeInTheDocument();
    // Owner can invite the placeholder member and remove others
    expect(within(panel).getByRole('button', { name: 'invite' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'delete' })).toBeInTheDocument();
  });

  it('hides member management for people who cannot manage members', () => {
    canManage = false;
    renderGroup();
    fireEvent.click(screen.getByRole('tab', { name: 'Members' }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Bob')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'delete' })).not.toBeInTheDocument();
  });

  it('keeps Add Member out of the page header', () => {
    renderGroup();
    fireEvent.click(screen.getByRole('tab', { name: 'Transactions' }));
    expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
  });
});
