import { Group } from '../types';

const STORAGE_KEY = 'split-transactions-groups';

export const saveGroups = (groups: Group[]): void => {
  console.log('Storage: Saving groups to localStorage:', groups);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    console.log('Storage: Successfully saved groups');
  } catch (error) {
    console.error('Storage: Error saving groups:', error);
  }
};

export const loadGroups = (): Group[] => {
  console.log('Storage: Loading groups from localStorage');
  const stored = localStorage.getItem(STORAGE_KEY);
  console.log('Storage: Raw stored data:', stored);
  
  if (!stored) {
    console.log('Storage: No stored data found');
    return [];
  }

  try {
    const groups = JSON.parse(stored);
    console.log('Storage: Parsed groups:', groups);
    return groups;
  } catch (error) {
    console.error('Storage: Error parsing stored data:', error);
    return [];
  }
}; 