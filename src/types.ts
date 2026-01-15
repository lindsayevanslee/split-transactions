export type MemberStatus = 'placeholder' | 'invited' | 'active';

export interface Member {
  id: string;
  name: string;
  balance: number;
  userId?: string;           // Firebase Auth UID if linked to account
  email?: string;            // Optional email for display
  status: MemberStatus;
  joinedAt?: Date;
}

export type SplitType = 'equal' | 'percentage' | 'exact' | 'shares';

export interface Split {
  memberId: string;
  amount: number;
  percentage?: number;
  shares?: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: string;
  notes: string;
  payerId: string;
  splitType: SplitType;
  splits: Split[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  date: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  name: string;
  userId: string;              // Owner's Firebase Auth UID
  memberUserIds: string[];     // All users who can access (owner + joined members)
  members: Member[];
  transactions: Transaction[];
  payments: Payment[];
  customCategories: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  memberId: string;            // Links to placeholder Member in the group
  invitedBy: string;           // Owner's userId
  status: InvitationStatus;
  token: string;               // Unique token for invite URL
  createdAt: Date;
  expiresAt: Date;
}

export const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Shopping',
  'Transportation',
  'Entertainment',
  'Utilities',
  'Travel',
  'Other'
]; 