import { DocumentData } from '@firebase/firestore';

// Generate a secure random token
export function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Get the base URL for invite links
export function getBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

// Generate the invite link URL
export function getInviteLink(token: string): string {
  return `${getBaseUrl()}#/accept-invite?token=${token}`;
}

export interface FirestoreInvitation {
  groupId: string;
  groupName: string;
  memberId: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired';
  token: string;
  createdAt: { toDate: () => Date };
  expiresAt: { toDate: () => Date };
  [key: string]: unknown;
}

export function isFirestoreInvitation(data: DocumentData | undefined): data is FirestoreInvitation {
  if (!data) return false;
  return (
    typeof data === 'object' &&
    'groupId' in data &&
    'groupName' in data &&
    'memberId' in data &&
    'invitedBy' in data &&
    'status' in data &&
    'token' in data &&
    'createdAt' in data &&
    'expiresAt' in data
  );
}
