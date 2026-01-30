import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  DocumentData,
  QuerySnapshot
} from '@firebase/firestore';
import { httpsCallable } from '@firebase/functions';
import { db, functions } from '../firebase/config';
import { Invitation } from '../types';
import {
  generateToken,
  getInviteLink,
  isFirestoreInvitation,
  FirestoreInvitation
} from './invitation-utils';

// Re-export for consumers that import from this file
export { generateToken, getInviteLink, isFirestoreInvitation };

// Invitations collection
export const invitationsCollection = collection(db, 'invitations');

function convertInvitation(id: string, data: FirestoreInvitation): Invitation {
  return {
    id,
    groupId: data.groupId,
    groupName: data.groupName,
    memberId: data.memberId,
    invitedBy: data.invitedBy,
    status: data.status,
    token: data.token,
    createdAt: data.createdAt.toDate(),
    expiresAt: data.expiresAt.toDate(),
  };
}

// Create a new invitation
export async function createInvitation(
  groupId: string,
  groupName: string,
  memberId: string,
  invitedBy: string
): Promise<{ invitation: Invitation; inviteLink: string }> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitationData = {
    groupId,
    groupName,
    memberId,
    invitedBy,
    status: 'pending' as const,
    token,
    createdAt: now,
    expiresAt,
  };

  const docRef = await addDoc(invitationsCollection, invitationData);

  return {
    invitation: {
      id: docRef.id,
      ...invitationData,
    },
    inviteLink: getInviteLink(token),
  };
}

// Get invitation by token
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const q = query(invitationsCollection, where('token', '==', token));
  const snapshot: QuerySnapshot<DocumentData> = await getDocs(q);

  if (snapshot.docs.length === 0) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  if (!isFirestoreInvitation(data)) {
    return null;
  }

  return convertInvitation(docSnap.id, data);
}

// Get pending invitations for a group
export async function getGroupInvitations(groupId: string): Promise<Invitation[]> {
  const q = query(
    invitationsCollection,
    where('groupId', '==', groupId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(docSnap => {
      const data = docSnap.data();
      if (!isFirestoreInvitation(data)) return null;
      return convertInvitation(docSnap.id, data);
    })
    .filter((inv): inv is Invitation => inv !== null);
}

// Accept an invitation - calls Cloud Function which handles this securely
// The Cloud Function has admin access so users don't need read access to groups
// they're not yet members of, preventing the Firebase security vulnerability
// where any authenticated user could read any group's data.
export async function acceptInvitation(
  invitationId: string,
  _userId: string, // Kept for API compatibility, but Cloud Function uses auth context
  userDisplayName?: string,
  userEmail?: string
): Promise<{ groupId: string }> {
  const acceptInvitationFn = httpsCallable<
    { invitationId: string; userDisplayName?: string; userEmail?: string },
    { groupId: string }
  >(functions, 'acceptInvitation');

  const result = await acceptInvitationFn({
    invitationId,
    userDisplayName,
    userEmail,
  });

  return result.data;
}

// Cancel/delete an invitation
export async function cancelInvitation(invitationId: string): Promise<void> {
  const invitationRef = doc(db, 'invitations', invitationId);
  await deleteDoc(invitationRef);
}
