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
  createGroup: (name: string) => Promise<void>;
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
            members: data.members,
            transactions: data.transactions.map((t: { date: Timestamp }) => ({
              ...t,
              date: t.date.toDate(),
            })),
            payments: data.payments.map((p: { date: Timestamp }) => ({
              ...p,
              date: p.date.toDate(),
            })),
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

  const createGroup = async (name: string) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupRef = doc(collection(db, 'groups'));
      const newGroup: Omit<Group, 'id'> = {
        name,
        userId: user.uid,
        members: [],
        transactions: [],
        payments: [],
      };
      await setDoc(groupRef, newGroup);
    } catch (error) {
      throw new Error('Failed to create group');
    }
  };

  const updateGroup = async (id: string, group: Group) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupRef = doc(db, 'groups', id);
      const { id: _, ...groupData } = group;
      await setDoc(groupRef, {
        ...groupData,
        transactions: groupData.transactions.map((t) => ({
          ...t,
          date: Timestamp.fromDate(new Date(t.date)),
        })),
        payments: groupData.payments.map((p) => ({
          ...p,
          date: Timestamp.fromDate(new Date(p.date)),
        })),
      });
    } catch (error) {
      throw new Error('Failed to update group');
    }
  };

  const deleteGroup = async (id: string) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupRef = doc(db, 'groups', id);
      await deleteDoc(groupRef);
    } catch (error) {
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