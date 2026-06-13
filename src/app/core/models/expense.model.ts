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
  /** When true, tenants of this property can see this expense and its description. */
  visibleToTenants?: boolean;
  /** 'all' = every tenant of the property, otherwise a specific tenant record id. */
  sharedWithTenantId?: string;
  /** Settlement state for expenses assigned to a single tenant. */
  settlementStatus?: ExpenseSettlementStatus;
  /** Tenants the cost is split across (snapshot when shared with 'all'). */
  splitTenantIds?: string[];
  /** Per-tenant settlement state for split (all-tenant) expenses. */
  tenantSettlements?: Record<string, ExpenseSettlementStatus>;
}

export type ExpenseSettlementStatus = 'unpaid' | 'pending_confirmation' | 'paid';

export const SHARE_WITH_ALL_TENANTS = 'all';

export const EXPENSE_SETTLEMENT_LABELS: Record<ExpenseSettlementStatus, string> = {
  unpaid: 'Unpaid',
  pending_confirmation: 'Awaiting confirmation',
  paid: 'Paid',
};

/** True when an expense is assigned to one specific tenant (not all tenants). */
export function isTenantAssignedExpense(expense: Pick<Expense, 'visibleToTenants' | 'sharedWithTenantId'>): boolean {
  return (
    expense.visibleToTenants === true &&
    !!expense.sharedWithTenantId &&
    expense.sharedWithTenantId !== SHARE_WITH_ALL_TENANTS
  );
}

/** True when an expense is split equally across several tenants. */
export function isSplitExpense(
  expense: Pick<Expense, 'visibleToTenants' | 'sharedWithTenantId' | 'splitTenantIds'>
): boolean {
  return (
    expense.visibleToTenants === true &&
    expense.sharedWithTenantId === SHARE_WITH_ALL_TENANTS &&
    !!expense.splitTenantIds &&
    expense.splitTenantIds.length > 0
  );
}

/** Each tenant's equal share of a split expense. */
export function expenseShareAmount(expense: Pick<Expense, 'amount' | 'splitTenantIds'>): number {
  const count = expense.splitTenantIds?.length ?? 0;
  return count > 0 ? expense.amount / count : expense.amount;
}

/** A tenant's settlement status within a split expense (defaults to unpaid). */
export function tenantShareStatus(expense: Expense, tenantId: string): ExpenseSettlementStatus {
  return expense.tenantSettlements?.[tenantId] ?? 'unpaid';
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
