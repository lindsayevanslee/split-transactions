"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptInvitation = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
/**
 * Cloud Function to securely accept an invitation.
 * This runs with admin privileges so users don't need read access to groups
 * they're not yet members of.
 */
exports.acceptInvitation = (0, https_1.onCall)(async (request) => {
    // Verify the user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in to accept an invitation');
    }
    const userId = request.auth.uid;
    const { invitationId, userDisplayName, userEmail } = request.data;
    if (!invitationId) {
        throw new https_1.HttpsError('invalid-argument', 'Invitation ID is required');
    }
    // Get the invitation
    const invitationRef = db.collection('invitations').doc(invitationId);
    const invitationSnap = await invitationRef.get();
    if (!invitationSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Invitation not found');
    }
    const invitationData = invitationSnap.data();
    // Validate invitation status
    if (invitationData.status !== 'pending') {
        throw new https_1.HttpsError('failed-precondition', 'Invitation is no longer valid');
    }
    // Check expiration
    const expiresAt = invitationData.expiresAt.toDate();
    if (new Date() > expiresAt) {
        // Mark as expired
        await invitationRef.update({ status: 'expired' });
        throw new https_1.HttpsError('failed-precondition', 'Invitation has expired');
    }
    // Get the group
    const groupRef = db.collection('groups').doc(invitationData.groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Group not found');
    }
    const groupData = groupSnap.data();
    // Check if user is already a member
    if (groupData.memberUserIds?.includes(userId)) {
        throw new https_1.HttpsError('already-exists', 'You are already a member of this group');
    }
    // Update the member with the user's account info
    const updatedMembers = groupData.members.map((member) => member.id === invitationData.memberId
        ? {
            ...member,
            userId,
            status: 'active',
            joinedAt: new Date(),
            name: userDisplayName || member.name,
            email: userEmail,
        }
        : member);
    // Update group: add userId to memberUserIds and update the member
    await groupRef.update({
        memberUserIds: firestore_1.FieldValue.arrayUnion(userId),
        members: updatedMembers,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    // Mark invitation as accepted
    await invitationRef.update({ status: 'accepted' });
    return { groupId: invitationData.groupId };
});
//# sourceMappingURL=index.js.map