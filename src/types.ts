export interface Member {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  payerId: string;
  category: string;
  split: {
    [memberId: string]: number;
  };
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