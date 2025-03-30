export interface Member {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  amount: number;
  date: Date;
  category: string;
  notes: string;
  payerId: string;
  splits: { memberId: string; amount: number; percentage?: number }[];
}

export interface Payment {
  id: string;
  amount: number;
  date: Date;
  fromMemberId: string;
  toMemberId: string;
  notes: string;
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
  transactions: Transaction[];
  payments: Payment[];
  customCategories: string[];
}

export const DEFAULT_CATEGORIES = [
  'Food & Drinks',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Utilities',
  'Other',
]; 