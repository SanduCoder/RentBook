export type ExpenseCategory =
  | 'water'
  | 'electricity'
  | 'repairs'
  | 'cleaning'
  | 'security'
  | 'other';

export interface Expense {
  id: string;
  propertyId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  createdBy: string;
  date: Date;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'water', label: 'Water' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  water: 'Water',
  electricity: 'Electricity',
  repairs: 'Repairs',
  cleaning: 'Cleaning',
  security: 'Security',
  other: 'Other',
};
