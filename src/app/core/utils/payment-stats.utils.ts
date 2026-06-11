import { Payment, PaymentStatus } from '../models/payment.model';
import { getMonthEnd, getMonthStart } from './firestore.utils';

/** Statuses that reduce outstanding rent (confirmed or awaiting landlord verification). */
export const RENT_CREDIT_STATUSES: PaymentStatus[] = [
  'paid',
  'partial',
  'pending_verification',
];

export interface RentUnit {
  id: string;
  monthlyRent: number;
  status?: string;
}

export interface RentTenant {
  id: string;
  unitId: string;
  monthlyRent: number;
  dueDay: number;
  active?: boolean;
}

export interface MonthlyDiscountSummary {
  totalDiscount: number;
  listedRent: number;
  quotedRent: number;
  discountedTenants: number;
}

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
  options?: { tenantId?: string; propertyId?: string; monthStart?: Date; now?: Date }
): number {
  const now = options?.now ?? new Date();
  const monthStart = options?.monthStart ?? getMonthStart(now);

  return payments
    .filter(
      (p) =>
        isRentCreditPayment(p) &&
        paymentAppliesToMonth(p, monthStart, now) &&
        (!options?.tenantId || p.tenantId === options.tenantId) &&
        (!options?.propertyId || p.propertyId === options.propertyId)
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

/**
 * Expected rent this month:
 * - occupied units → tenant contract rent (what they actually owe)
 * - vacant units → unit listing rent (potential income)
 */
export function calculateExpectedMonthlyRent(
  units: RentUnit[],
  tenants: RentTenant[] = []
): number {
  const tenantByUnitId = new Map(
    tenants
      .filter((tenant) => tenant.active !== false)
      .map((tenant) => [tenant.unitId, tenant])
  );

  return units
    .filter((unit) => unit.status !== 'maintenance')
    .reduce((sum, unit) => {
      const tenant = tenantByUnitId.get(unit.id);
      if (tenant) {
        return sum + tenant.monthlyRent;
      }
      return sum + unit.monthlyRent;
    }, 0);
}

/**
 * Rent still owed this month across the property/portfolio:
 * expected rent minus payments received this month.
 */
export function calculateToCollect(
  units: RentUnit[],
  payments: Payment[],
  options?: { propertyId?: string; tenants?: RentTenant[]; now?: Date }
): number {
  const now = options?.now ?? new Date();
  const monthStart = getMonthStart(now);
  const expected = calculateExpectedMonthlyRent(units, options?.tenants ?? []);
  const credited = sumRentCredits(payments, {
    propertyId: options?.propertyId,
    monthStart,
    now,
  });

  return Math.max(0, expected - credited);
}

/**
 * Monthly rent gap between unit list prices and tenant quoted rates.
 * Only counts occupied tenants where unit rent exceeds tenant rent.
 */
export function calculateMonthlyDiscount(
  units: RentUnit[],
  tenants: RentTenant[] = []
): MonthlyDiscountSummary {
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  let totalDiscount = 0;
  let listedRent = 0;
  let quotedRent = 0;
  let discountedTenants = 0;

  for (const tenant of tenants.filter((item) => item.active !== false)) {
    const unit = unitById.get(tenant.unitId);
    if (!unit) {
      continue;
    }

    listedRent += unit.monthlyRent;
    quotedRent += tenant.monthlyRent;

    if (unit.monthlyRent > tenant.monthlyRent) {
      totalDiscount += unit.monthlyRent - tenant.monthlyRent;
      discountedTenants += 1;
    }
  }

  return { totalDiscount, listedRent, quotedRent, discountedTenants };
}

/** Past-due rent only — occupied tenants past due day who still owe money. */
export function calculateOutstandingRent(
  tenants: RentTenant[],
  payments: Payment[],
  now = new Date()
): number {
  const monthStart = getMonthStart(now);

  return tenants
    .filter((tenant) => tenant.active !== false)
    .reduce((total, tenant) => {
      const credited = sumRentCredits(payments, { tenantId: tenant.id, monthStart, now });
      const pastDue = now.getDate() >= tenant.dueDay;

      if (pastDue && credited < tenant.monthlyRent) {
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
