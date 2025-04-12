import { 
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Group, Transaction, Payment } from '../types';

// Groups collection
export const groupsCollection = collection(db, 'groups');

export const createGroup = async (group: Omit<Group, 'id'>) => {
  const groupRef = doc(groupsCollection);
  const newGroup = {
    ...group,
    id: groupRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  await setDoc(groupRef, newGroup);
  return newGroup;
};

export const getGroup = async (groupId: string) => {
  const groupRef = doc(groupsCollection, groupId);
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    throw new Error('Group not found');
  }
  return groupSnap.data() as Group;
};

export const getUserGroups = async (userId: string) => {
  const q = query(groupsCollection, where('members', 'array-contains', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Group);
};

export const updateGroup = async (groupId: string, group: Partial<Group>) => {
  const groupRef = doc(groupsCollection, groupId);
  await updateDoc(groupRef, {
    ...group,
    updatedAt: Timestamp.now()
  });
};

export const deleteGroup = async (groupId: string) => {
  const groupRef = doc(groupsCollection, groupId);
  await deleteDoc(groupRef);
};

// Helper function to convert Firestore Timestamps to Dates
export const convertTimestamps = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp) return data.toDate();
  if (Array.isArray(data)) return data.map(convertTimestamps);
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, convertTimestamps(value)])
    );
  }
  return data;
}; 