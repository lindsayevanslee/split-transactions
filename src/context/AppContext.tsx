import { createContext, useContext, useEffect, useState } from 'react';
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
  createGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateGroup: (groupId: string, group: Partial<Group>) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
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
    const q = query(groupsRef, where('userId', '==', user.uid)) as Query<DocumentData>;

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
              members: data.members || [],
              transactions: (data.transactions || []).map((t: { date: { toDate: () => Date } }) => ({
                ...t,
                date: t.date.toDate(),
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

  const createGroup = async (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) throw new Error('User must be logged in');

    try {
      const groupsRef = collection(db, 'groups') as CollectionReference<DocumentData>;
      const docRef = await addDoc(groupsRef, {
        ...group,
        userId: user.uid,
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
      await updateDoc(docRef, {
        ...group,
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

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}; 