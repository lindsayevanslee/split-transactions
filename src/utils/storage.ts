import { Group } from '../types';

const STORAGE_KEY = 'split-transactions-data';

export const saveGroups = (groups: Group[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
};

export const loadGroups = (): Group[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  
  const groups = JSON.parse(data);
  // Convert date strings back to Date objects
  return groups.map((group: Group) => ({
    ...group,
    transactions: group.transactions.map(transaction => ({
      ...transaction,
      date: new Date(transaction.date)
    }))
  }));
}; 