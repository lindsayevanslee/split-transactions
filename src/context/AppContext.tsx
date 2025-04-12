import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { Group } from '../types';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';

interface AppContextType {
  groups: Group[];
  loading: boolean;
  error: string | null;
  createGroup: (groupData: Omit<Group, 'id'>) => Promise<void>;
  updateGroup: (id: string, group: Group) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  groups: [],
  loading: false,
  error: null,
  createGroup: async () => {},
  updateGroup: async () => {},
  deleteGroup: async () => {},
});

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
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

    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const groupsData: Group[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          groupsData.push({
            id: doc.id,
            name: data.name,
            userId: data.userId,
            members: data.members || [],
            transactions: (data.transactions || []).map((t: { date: Timestamp }) => ({
              ...t,
              date: t.date.toDate(),
            })),
            payments: (data.payments || []).map((p: { date: Timestamp }) => ({
              ...p,
              date: p.date.toDate(),
            })),
            customCategories: data.customCategories || [],
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        });
        setGroups(groupsData);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const createGroup = async (groupData: Omit<Group, 'id'>) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupRef = doc(collection(db, 'groups'));
      const newGroup = {
        ...groupData,
        userId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await setDoc(groupRef, newGroup);
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Failed to create group');
    }
  };

  const updateGroup = async (id: string, group: Group) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupRef = doc(db, 'groups', id);
      const { id: _, ...groupData } = group;
      
      // Convert all dates to Firestore timestamps
      const firestoreData = {
        ...groupData,
        transactions: groupData.transactions.map((t) => ({
          ...t,
          date: Timestamp.fromDate(new Date(t.date)),
          splits: t.splits.map(split => ({
            ...split,
            amount: Number(split.amount),
            percentage: split.percentage ? Number(split.percentage) : undefined
          }))
        })),
        payments: groupData.payments.map((p) => ({
          ...p,
          date: Timestamp.fromDate(new Date(p.date)),
          amount: Number(p.amount)
        })),
        updatedAt: Timestamp.now()
      };

      await setDoc(groupRef, firestoreData, { merge: true });
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Failed to update group');
    }
  };

  const deleteGroup = async (id: string) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupRef = doc(db, 'groups', id);
      await deleteDoc(groupRef);
    } catch (error) {
      console.error('Firestore error:', error);
      throw new Error('Failed to delete group');
    }
  };

  return (
    <AppContext.Provider
      value={{
        groups,
        loading,
        error,
        createGroup,
        updateGroup,
        deleteGroup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext); 