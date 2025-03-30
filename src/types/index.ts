export interface Group {
  id: string;
  name: string;
  members: Member[];
  transactions: Transaction[];
  payments: Payment[];
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
  splits: Array<{
    memberId: string;
    amount: number;
    percentage?: number;
  }>;
}

export interface Payment {
  id: string;
  amount: number;
  date: Date;
  fromMemberId: string;
  toMemberId: string;
  notes: string;
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