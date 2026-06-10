import { Payment, PaymentStatus } from '../models/payment.model';
import { getMonthStart } from './firestore.utils';

/** Statuses that reduce outstanding rent (confirmed or awaiting landlord verification). */
export const RENT_CREDIT_STATUSES: PaymentStatus[] = [
  'paid',
  'partial',
  'pending_verification',
];

export function isRentCreditStatus(status: PaymentStatus): boolean {
  return RENT_CREDIT_STATUSES.includes(status);
}

/** Whether a payment counts toward this month's collected / outstanding figures. */
export function paymentAppliesToMonth(
  payment: Payment,
  monthStart: Date,
  now = new Date()
): boolean {
  if (payment.date >= monthStart) {
    return true;
  }

  // Tenant reports often use the payment date; bucket by createdAt for pending items.
  if (
    payment.status === 'pending_verification' &&
    payment.reportedByTenant &&
    payment.createdAt >= monthStart &&
    payment.createdAt <= now
  ) {
    return true;
  }

  return false;
}

export function sumRentCredits(
  payments: Payment[],
  options?: { tenantId?: string; monthStart?: Date; now?: Date }
): number {
  const now = options?.now ?? new Date();
  const monthStart = options?.monthStart ?? getMonthStart(now);

  return payments
    .filter(
      (p) =>
        isRentCreditStatus(p.status) &&
        paymentAppliesToMonth(p, monthStart, now) &&
        (!options?.tenantId || p.tenantId === options.tenantId)
    )
    .reduce((sum, p) => sum + p.amount, 0);
}

export function sumConfirmedCollected(
  payments: Payment[],
  monthStart: Date,
  monthEnd?: Date
): number {
  return payments
    .filter((p) => {
      if (p.status !== 'paid' && p.status !== 'partial') {
        return false;
      }

      if (p.date < monthStart) {
        return false;
      }

      return !monthEnd || p.date < monthEnd;
    })
    .reduce((sum, p) => sum + p.amount, 0);
}

export function calculateOutstandingRent(
  tenants: { id: string; monthlyRent: number; dueDay: number }[],
  payments: Payment[],
  now = new Date()
): number {
  const monthStart = getMonthStart(now);

  return tenants.reduce((total, tenant) => {
    const credited = sumRentCredits(payments, { tenantId: tenant.id, monthStart, now });
    const due = now.getDate() >= tenant.dueDay;

    if (due && credited < tenant.monthlyRent) {
      return total + (tenant.monthlyRent - credited);
    }

    return total;
  }, 0);
}
