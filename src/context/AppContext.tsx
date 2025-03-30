import React, { createContext, useContext, useState, useEffect } from 'react';
import { Group } from '../types';
import { loadGroups, saveGroups } from '../utils/storage';

interface AppContextType {
  groups: Group[];
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  deleteGroup: (groupId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    console.log('AppProvider: Loading groups from storage');
    const loadedGroups = loadGroups();
    console.log('AppProvider: Loaded groups:', loadedGroups);
    setGroups(loadedGroups);
  }, []);

  useEffect(() => {
    console.log('AppProvider: Saving groups to storage:', groups);
    saveGroups(groups);
  }, [groups]);

  const addGroup = (group: Group) => {
    console.log('AppProvider: Adding new group:', group);
    setGroups([...groups, group]);
  };

  const updateGroup = (updatedGroup: Group) => {
    console.log('AppProvider: Updating group:', updatedGroup);
    setGroups(groups.map(group => 
      group.id === updatedGroup.id ? updatedGroup : group
    ));
  };

  const deleteGroup = (groupId: string) => {
    console.log('AppProvider: Deleting group:', groupId);
    setGroups(groups.filter(group => group.id !== groupId));
  };

  return (
    <AppContext.Provider value={{ groups, addGroup, updateGroup, deleteGroup }}>
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