import { Payment } from '../models/payment.model';
import { Tenant } from '../models/tenant.model';
import { getMonthStart } from './firestore.utils';
import { sumRentCredits } from './payment-stats.utils';

export type TenantRentStatus = 'paid' | 'overdue' | 'due_soon' | 'upcoming';

export interface TenantRentStatusInfo {
  status: TenantRentStatus;
  statusLabel: string;
  dateLabel: string;
  dateValue: Date;
}

export function getTenantRentStatus(tenant: Tenant, payments: Payment[], now = new Date()): TenantRentStatusInfo {
  const monthStart = getMonthStart(now);
  const paidThisMonth = sumRentCredits(payments, { tenantId: tenant.id, monthStart, now });

  const nextDue = nextDueDate(tenant.dueDay, now);
  const currentDue = new Date(now.getFullYear(), now.getMonth(), tenant.dueDay);

  if (paidThisMonth >= tenant.monthlyRent) {
    return {
      status: 'paid',
      statusLabel: 'Paid',
      dateLabel: 'Next',
      dateValue: nextDue,
    };
  }

  if (now.getDate() > tenant.dueDay) {
    return {
      status: 'overdue',
      statusLabel: 'Overdue',
      dateLabel: 'Due',
      dateValue: currentDue,
    };
  }

  const daysUntilDue = tenant.dueDay - now.getDate();
  if (daysUntilDue <= 7) {
    return {
      status: 'due_soon',
      statusLabel: 'Due Soon',
      dateLabel: 'Due',
      dateValue: currentDue,
    };
  }

  return {
    status: 'upcoming',
    statusLabel: 'Upcoming',
    dateLabel: 'Due',
    dateValue: currentDue,
  };
}

function nextDueDate(dueDay: number, from: Date): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), dueDay);
  if (from.getDate() >= dueDay) {
    return new Date(from.getFullYear(), from.getMonth() + 1, dueDay);
  }
  return candidate;
}
