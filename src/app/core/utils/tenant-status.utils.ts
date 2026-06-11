import { Payment } from '../models/payment.model';
import { Tenant } from '../models/tenant.model';
import { getMonthStart } from './firestore.utils';
import { sumRentCredits } from './payment-stats.utils';

export interface RentDueTenant {
  tenantId: string;
  propertyId: string;
  tenantName: string;
  unitName: string;
  phone: string;
  monthlyRent: number;
  dueDate: Date;
  isOverdue: boolean;
  isUnpaid: boolean;
  recipientUserId?: string;
}

export interface PropertyRentDueSummary {
  nearest: RentDueTenant | null;
  dueThisWeekCount: number;
}

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

/** Earliest unpaid rent due and how many tenants owe rent within the next 7 days. */
export function getPropertyRentDueSummary(
  tenants: Tenant[],
  unitNames: Map<string, string>,
  payments: Payment[],
  now = new Date()
): PropertyRentDueSummary {
  if (!tenants.length) {
    return { nearest: null, dueThisWeekCount: 0 };
  }

  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  const items = tenants.map((tenant) => {
    const tenantPayments = payments.filter((p) => p.tenantId === tenant.id);
    const rentStatus = getTenantRentStatus(tenant, tenantPayments, now);
    return {
      tenantId: tenant.id,
      propertyId: tenant.propertyId,
      tenantName: tenant.name,
      unitName: unitNames.get(tenant.unitId) ?? 'Unit',
      phone: tenant.phone,
      monthlyRent: tenant.monthlyRent,
      dueDate: rentStatus.dateValue,
      isPaid: rentStatus.status === 'paid',
      isOverdue: rentStatus.status === 'overdue',
      recipientUserId: tenant.userId,
    };
  });

  const unpaid = items
    .filter((item) => !item.isPaid)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const nearestUnpaid = unpaid[0];
  const nearestPaid = [...items]
    .filter((item) => item.isPaid)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  const nearestSource = nearestUnpaid ?? nearestPaid ?? null;

  const dueThisWeekCount = unpaid.filter(
    (item) => item.dueDate <= weekEnd
  ).length;

  return {
    nearest: nearestSource
      ? {
          tenantId: nearestSource.tenantId,
          propertyId: nearestSource.propertyId,
          tenantName: nearestSource.tenantName,
          unitName: nearestSource.unitName,
          phone: nearestSource.phone,
          monthlyRent: nearestSource.monthlyRent,
          dueDate: nearestSource.dueDate,
          isOverdue: nearestSource.isOverdue,
          isUnpaid: !!nearestUnpaid,
          recipientUserId: nearestSource.recipientUserId,
        }
      : null,
    dueThisWeekCount,
  };
}
