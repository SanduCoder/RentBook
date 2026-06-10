export type SharedBillType =
  | 'water'
  | 'electricity'
  | 'watchman'
  | 'garbage'
  | 'gate_repairs'
  | 'community_fees'
  | 'other';

export type SplitMethod = 'equal';

export interface SharedBill {
  id: string;
  propertyId: string;
  type: SharedBillType;
  amount: number;
  households: number;
  splitMethod: SplitMethod;
  description?: string;
  date: Date;
  createdBy: string;
}

export const SHARED_BILL_TYPES: { value: SharedBillType; label: string }[] = [
  { value: 'water', label: 'Water Bill' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'watchman', label: 'Watchman Salary' },
  { value: 'garbage', label: 'Garbage Collection' },
  { value: 'gate_repairs', label: 'Gate Repairs' },
  { value: 'community_fees', label: 'Community Fees' },
  { value: 'other', label: 'Other' },
];

export const SHARED_BILL_TYPE_LABELS: Record<SharedBillType, string> = {
  water: 'Water Bill',
  electricity: 'Electricity',
  watchman: 'Watchman Salary',
  garbage: 'Garbage Collection',
  gate_repairs: 'Gate Repairs',
  community_fees: 'Community Fees',
  other: 'Other',
};

export function calculatePerHousehold(amount: number, households: number): number {
  if (households <= 0) return 0;
  return Math.round((amount / households) * 100) / 100;
}
