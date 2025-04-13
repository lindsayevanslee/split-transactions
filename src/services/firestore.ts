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
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Group } from '../types';

type FirestoreGroup = Omit<Group, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  [key: string]: unknown;
};

function isFirestoreGroup(data: DocumentData): data is FirestoreGroup {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'userId' in data &&
    'members' in data &&
    'transactions' in data &&
    'payments' in data &&
    'createdAt' in data &&
    'updatedAt' in data &&
    typeof data.createdAt === 'object' &&
    data.createdAt !== null &&
    'toDate' in data.createdAt &&
    typeof data.createdAt.toDate === 'function' &&
    typeof data.updatedAt === 'object' &&
    data.updatedAt !== null &&
    'toDate' in data.updatedAt &&
    typeof data.updatedAt.toDate === 'function'
  );
}

// Groups collection
export const groupsCollection = collection(db, 'groups');

export const createGroup = async (group: Omit<Group, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(groupsCollection, {
      ...group,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    const data = groupSnap.data();
    
    if (!data || !isFirestoreGroup(data)) {
      return null;
    }

    return {
      id: groupId,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate()
    };
  } catch (error) {
    console.error('Error getting group:', error);
    throw error;
  }
};

export const getUserGroups = async (userId: string): Promise<Group[]> => {
  try {
    const q = query(groupsCollection, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      if (!isFirestoreGroup(data)) {
        throw new Error(`Invalid group data for document ${doc.id}`);
      }
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      };
    });
  } catch (error) {
    console.error('Error getting user groups:', error);
    throw error;
  }
};

export const updateGroup = async (groupId: string, group: Partial<Group>): Promise<void> => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      ...group,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating group:', error);
    throw error;
  }
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    await deleteDoc(groupRef);
  } catch (error) {
    console.error('Error deleting group:', error);
    throw error;
  }
};

interface FirestoreTimestamp {
  toDate: () => Date;
}

type TimestampData = {
  [key: string]: unknown | FirestoreTimestamp;
}

export const convertTimestamp = (data: unknown): unknown => {
  if (data && typeof data === 'object' && 'toDate' in data && typeof data.toDate === 'function') {
    return (data as FirestoreTimestamp).toDate();
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as TimestampData).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: convertTimestamp(value)
    }), {});
  }
  return data;
}; 