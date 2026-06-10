import { Payment, PaymentStatus } from '../models/payment.model';
import { getMonthEnd, getMonthStart } from './firestore.utils';

/** Statuses that reduce outstanding rent (confirmed or awaiting landlord verification). */
export const RENT_CREDIT_STATUSES: PaymentStatus[] = [
  'paid',
  'partial',
  'pending_verification',
];

export function isPendingTenantReport(payment: Payment): boolean {
  return (
    !!payment.reportedByTenant &&
    payment.status !== 'paid' &&
    payment.status !== 'partial'
  );
}

export function isRentCreditPayment(payment: Payment): boolean {
  if (payment.status === 'pending_verification') {
    return true;
  }
  if (payment.status === 'paid' || payment.status === 'partial') {
    return true;
  }
  return isPendingTenantReport(payment);
}

/** Best date for deciding which month a payment belongs to. */
export function paymentBucketDate(payment: Payment): Date {
  const created = payment.createdAt;
  if (created && !Number.isNaN(created.getTime())) {
    return created;
  }
  return payment.date;
}

/** Whether a payment counts toward this month's collected / outstanding figures. */
export function paymentAppliesToMonth(
  payment: Payment,
  monthStart: Date,
  now = new Date()
): boolean {
  const monthEnd = getMonthEnd(now);

  // Unresolved tenant reports always show on the current overview.
  if (isPendingTenantReport(payment) || payment.status === 'pending_verification') {
    return true;
  }

  const bucket = paymentBucketDate(payment);
  if (bucket >= monthStart && bucket <= monthEnd) {
    return true;
  }

  if (payment.date >= monthStart && payment.date <= monthEnd) {
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
        isRentCreditPayment(p) &&
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

export function countPendingPaymentReports(payments: Payment[]): number {
  return payments.filter(
    (p) => p.status === 'pending_verification' || isPendingTenantReport(p)
  ).length;
}
