import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

interface Member {
  id: string;
  name: string;
  userId: string | null;
  email?: string;
  status: 'placeholder' | 'invited' | 'active';
  joinedAt?: Date;
}

interface AcceptInvitationData {
  invitationId: string;
  userDisplayName?: string;
  userEmail?: string;
}

/**
 * Cloud Function to securely accept an invitation.
 * This runs with admin privileges so users don't need read access to groups
 * they're not yet members of.
 */
export const acceptInvitation = onCall(async (request) => {
  // Verify the user is authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in to accept an invitation');
  }

  const userId = request.auth.uid;
  const { invitationId, userDisplayName, userEmail } = request.data as AcceptInvitationData;

  if (!invitationId) {
    throw new HttpsError('invalid-argument', 'Invitation ID is required');
  }

  // Get the invitation
  const invitationRef = db.collection('invitations').doc(invitationId);
  const invitationSnap = await invitationRef.get();

  if (!invitationSnap.exists) {
    throw new HttpsError('not-found', 'Invitation not found');
  }

  const invitationData = invitationSnap.data()!;

  // Validate invitation status
  if (invitationData.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Invitation is no longer valid');
  }

  // Check expiration
  const expiresAt = invitationData.expiresAt.toDate();
  if (new Date() > expiresAt) {
    // Mark as expired
    await invitationRef.update({ status: 'expired' });
    throw new HttpsError('failed-precondition', 'Invitation has expired');
  }

  // Get the group
  const groupRef = db.collection('groups').doc(invitationData.groupId);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) {
    throw new HttpsError('not-found', 'Group not found');
  }

  const groupData = groupSnap.data()!;

  // Check if user is already a member
  if (groupData.memberUserIds?.includes(userId)) {
    throw new HttpsError('already-exists', 'You are already a member of this group');
  }

  // Update the member with the user's account info
  const updatedMembers: Member[] = groupData.members.map((member: Member) =>
    member.id === invitationData.memberId
      ? {
          ...member,
          userId,
          status: 'active' as const,
          joinedAt: new Date(),
          name: userDisplayName || member.name,
          email: userEmail,
        }
      : member
  );

  // Update group: add userId to memberUserIds and update the member
  await groupRef.update({
    memberUserIds: FieldValue.arrayUnion(userId),
    members: updatedMembers,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Mark invitation as accepted
  await invitationRef.update({ status: 'accepted' });

  return { groupId: invitationData.groupId };
});
