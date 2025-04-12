export interface Member {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: string;
  notes: string;
  payerId: string;
  splits: Array<{
    memberId: string;
    amount: number;
    percentage?: number;
  }>;
}

export interface Payment {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  date: Date;
  notes: string;
}

export interface Group {
  id: string;
  name: string;
  userId: string;
  members: Member[];
  transactions: Transaction[];
  payments: Payment[];
  customCategories: string[];
  createdAt: Date;
  updatedAt: Date;
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