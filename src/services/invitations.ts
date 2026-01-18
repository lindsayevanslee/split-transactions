import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  DocumentData,
  DocumentSnapshot,
  QuerySnapshot
} from '@firebase/firestore';
import { db } from '../firebase/config';
import { Invitation, Member } from '../types';
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

// Accept an invitation - links the user account to the member
export async function acceptInvitation(
  invitationId: string,
  userId: string,
  userDisplayName?: string,
  userEmail?: string
): Promise<{ groupId: string }> {
  // Get the invitation
  const invitationRef = doc(db, 'invitations', invitationId);
  const invitationSnap: DocumentSnapshot<DocumentData> = await getDoc(invitationRef);
  const invitationRawData = invitationSnap.data();

  if (!invitationRawData) {
    throw new Error('Invitation not found');
  }

  if (!isFirestoreInvitation(invitationRawData)) {
    throw new Error('Invalid invitation data');
  }

  const invitationData = invitationRawData;

  if (invitationData.status !== 'pending') {
    throw new Error('Invitation is no longer valid');
  }

  if (new Date() > invitationData.expiresAt.toDate()) {
    // Mark as expired
    await updateDoc(invitationRef, { status: 'expired' });
    throw new Error('Invitation has expired');
  }

  // Get the group
  const groupRef = doc(db, 'groups', invitationData.groupId);
  const groupSnap: DocumentSnapshot<DocumentData> = await getDoc(groupRef);
  const groupRawData = groupSnap.data();

  if (!groupRawData) {
    throw new Error('Group not found');
  }

  const groupData = groupRawData as { members: Member[]; memberUserIds: string[] };

  // Update the member with the user's account and display name
  const updatedMembers: Member[] = groupData.members.map(member =>
    member.id === invitationData.memberId
      ? {
          ...member,
          userId,
          status: 'active' as const,
          joinedAt: new Date(),
          // Update name to user's display name if available, otherwise keep original
          name: userDisplayName || member.name,
          email: userEmail,
        }
      : member
  );

  // Update group: add userId to memberUserIds and update the member
  await updateDoc(groupRef, {
    memberUserIds: [...(groupData.memberUserIds || []), userId],
    members: updatedMembers,
    updatedAt: new Date(),
  });

  // Mark invitation as accepted
  await updateDoc(invitationRef, { status: 'accepted' });

  return { groupId: invitationData.groupId };
}

// Cancel/delete an invitation
export async function cancelInvitation(invitationId: string): Promise<void> {
  const invitationRef = doc(db, 'invitations', invitationId);
  await deleteDoc(invitationRef);
}
