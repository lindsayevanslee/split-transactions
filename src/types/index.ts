export interface Group {
  id: string;
  name: string;
  members: Member[];
  transactions: Transaction[];
  customCategories: string[];
}

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
  splits: Split[];
}

export interface Split {
  memberId: string;
  amount: number;
  percentage?: number;
}

export interface Payment {
  id: string;
  transactionId: string;
  memberId: string;
  amount: number;
  date: Date;
}

export const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Bills & Utilities',
  'Travel',
  'Other'
] as const; 