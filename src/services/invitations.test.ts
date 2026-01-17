import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateToken, getInviteLink, isFirestoreInvitation } from './invitations';

// Mock window.location for getBaseUrl tests
const mockLocation = {
  origin: 'https://example.com',
  pathname: '/split-transactions/',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('generateToken', () => {
  it('generates a 48-character hex string', () => {
    const token = generateToken();
    expect(token).toHaveLength(48); // 24 bytes * 2 chars per byte
  });

  it('generates only valid hex characters', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('getInviteLink', () => {
  it('generates correct invite link format', () => {
    const token = 'abc123';
    const link = getInviteLink(token);

    expect(link).toBe('https://example.com/split-transactions/#/accept-invite?token=abc123');
  });

  it('handles tokens with special characters', () => {
    const token = '0a1b2c3d4e5f';
    const link = getInviteLink(token);

    expect(link).toContain('token=0a1b2c3d4e5f');
  });

  it('includes the hash router path', () => {
    const token = 'test';
    const link = getInviteLink(token);

    expect(link).toContain('#/accept-invite');
  });
});

describe('isFirestoreInvitation', () => {
  const validInvitation = {
    groupId: 'group-123',
    groupName: 'Test Group',
    memberId: 'member-456',
    invitedBy: 'user-789',
    status: 'pending' as const,
    token: 'abc123',
    createdAt: { toDate: () => new Date() },
    expiresAt: { toDate: () => new Date() },
  };

  it('returns true for valid invitation data', () => {
    expect(isFirestoreInvitation(validInvitation)).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(isFirestoreInvitation(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFirestoreInvitation(null as unknown as undefined)).toBe(false);
  });

  it('returns false when groupId is missing', () => {
    const { groupId, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false when groupName is missing', () => {
    const { groupName, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false when memberId is missing', () => {
    const { memberId, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false when invitedBy is missing', () => {
    const { invitedBy, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false when status is missing', () => {
    const { status, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false when token is missing', () => {
    const { token, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false when createdAt is missing', () => {
    const { createdAt, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false when expiresAt is missing', () => {
    const { expiresAt, ...incomplete } = validInvitation;
    expect(isFirestoreInvitation(incomplete)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(isFirestoreInvitation({})).toBe(false);
  });

  it('returns true when extra fields are present', () => {
    const withExtra = { ...validInvitation, extraField: 'value' };
    expect(isFirestoreInvitation(withExtra)).toBe(true);
  });
});
