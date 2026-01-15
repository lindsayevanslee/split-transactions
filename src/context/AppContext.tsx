import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Group } from '../types';
import { db } from '../firebase/config';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot,
  CollectionReference,
  DocumentReference,
  Query
} from '@firebase/firestore';

interface AppContextType {
  groups: Group[];
  loading: boolean;
  error: string | null;
  createGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'memberUserIds'>) => Promise<string>;
  updateGroup: (groupId: string, group: Partial<Group>) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  isGroupOwner: (groupId: string) => boolean;
  canManageMembers: (groupId: string) => boolean;
  syncDisplayName: (displayName: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const groupsRef = collection(db, 'groups') as CollectionReference<DocumentData>;
    // Query for groups where user is in memberUserIds (includes both owned and joined groups)
    const q = query(groupsRef, where('memberUserIds', 'array-contains', user.uid)) as Query<DocumentData>;

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const groupsData: Group[] = [];
        snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          if (data) {
            groupsData.push({
              id: doc.id,
              name: data.name,
              userId: data.userId,
              memberUserIds: data.memberUserIds || [data.userId],
              members: (data.members || []).map((m: { status?: string; joinedAt?: { toDate: () => Date } }) => ({
                ...m,
                status: m.status || 'placeholder',
                joinedAt: m.joinedAt?.toDate?.(),
              })),
              transactions: (data.transactions || []).map((t: { date: { toDate: () => Date }, splitType?: string }) => ({
                ...t,
                date: t.date.toDate(),
                splitType: t.splitType || 'percentage',
              })),
              payments: (data.payments || []).map((p: { date: { toDate: () => Date } }) => ({
                ...p,
                date: p.date.toDate(),
              })),
              customCategories: data.customCategories || [],
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            });
          }
        });
        setGroups(groupsData);
        setLoading(false);
      },
      (err: Error) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createGroup = async (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'memberUserIds'>) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupsRef = collection(db, 'groups') as CollectionReference<DocumentData>;
      const docRef = await addDoc(groupsRef, {
        ...group,
        userId: user.uid,
        memberUserIds: [user.uid], // Initialize with owner in memberUserIds
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      throw error;
    }
  };

  const updateGroup = async (groupId: string, group: Partial<Group>) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const docRef = doc(db, 'groups', groupId) as DocumentReference<DocumentData>;

      // Sanitize the data to remove undefined values and handle nested objects
      const sanitizeForFirestore = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value === undefined) continue; // Skip undefined values
          if (Array.isArray(value)) {
            // Sanitize each item in arrays
            result[key] = value.map(item =>
              typeof item === 'object' && item !== null
                ? sanitizeForFirestore(item as Record<string, unknown>)
                : item
            );
          } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
            // Recursively sanitize nested objects (but not Dates)
            result[key] = sanitizeForFirestore(value as Record<string, unknown>);
          } else {
            result[key] = value;
          }
        }
        return result;
      };

      const sanitizedGroup = sanitizeForFirestore(group as Record<string, unknown>);

      await updateDoc(docRef, {
        ...sanitizedGroup,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      throw error;
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const docRef = doc(db, 'groups', groupId) as DocumentReference<DocumentData>;
      await deleteDoc(docRef);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      throw error;
    }
  };

  // Check if current user is the owner of a group
  const isGroupOwner = useCallback((groupId: string): boolean => {
    if (!user) return false;
    const group = groups.find(g => g.id === groupId);
    return group?.userId === user.uid;
  }, [user, groups]);

  // Check if current user can manage members (only owners can)
  const canManageMembers = useCallback((groupId: string): boolean => {
    return isGroupOwner(groupId);
  }, [isGroupOwner]);

  // Sync display name across all groups where user is a member
  const syncDisplayName = useCallback(async (displayName: string) => {
    if (!user) throw new Error('User must be logged in');

    // Helper to remove undefined values from member objects
    const sanitizeMember = (member: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(member)) {
        if (value !== undefined) {
          result[key] = value;
        }
      }
      return result;
    };

    // Update the member name in all groups where this user is a member
    const updatePromises = groups.map(async (group) => {
      const memberIndex = group.members.findIndex(m => m.userId === user.uid);
      if (memberIndex === -1) return; // User not found as a linked member in this group

      const currentMember = group.members[memberIndex];
      if (currentMember.name === displayName) return; // Name already matches

      // Update the member's name and sanitize all members
      const updatedMembers = group.members.map(m => {
        const updated = m.userId === user.uid ? { ...m, name: displayName } : { ...m };
        return sanitizeMember(updated as unknown as Record<string, unknown>);
      });

      const docRef = doc(db, 'groups', group.id) as DocumentReference<DocumentData>;
      await updateDoc(docRef, {
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
    });

    await Promise.all(updatePromises);
  }, [user, groups]);

  return (
    <AppContext.Provider
      value={{
        groups,
        loading,
        error,
        createGroup,
        updateGroup,
        deleteGroup,
        isGroupOwner,
        canManageMembers,
        syncDisplayName,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
