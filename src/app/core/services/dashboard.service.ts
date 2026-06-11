import { Injectable, inject } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { ExpenseService } from './expense.service';
import { MaintenanceService } from './maintenance.service';
import { PaymentService } from './payment.service';
import { PropertyService } from './property.service';
import { TenantService } from './tenant.service';
import { UnitService } from './unit.service';
import { PAYMENT_METHOD_LABELS } from '../models/payment.model';
import { getMonthStart } from '../utils/firestore.utils';
import {
  calculateExpectedMonthlyRent,
  calculateMonthlyDiscount,
  calculateOutstandingRent,
  calculateToCollect,
  countPendingPaymentReports,
  sumConfirmedCollected,
  sumRentCredits,
} from '../utils/payment-stats.utils';
import { isTenant, isTenancyLinked } from '../utils/role.utils';

export interface DashboardStats {
  collectedThisMonth: number;
  expectedMonthlyRent: number;
  toCollect: number;
  outstandingRent: number;
  occupiedUnits: number;
  vacantUnits: number;
  totalUnits: number;
  pendingRequests: number;
  pendingPaymentReports: number;
  monthlyExpenses: number;
  currency: string;
  collectedTrend: number;
  outstandingTrend: number;
  monthlyDiscount: number;
  listedRent: number;
  quotedRent: number;
  discountedTenants: number;
}

export interface ActivityItem {
  id: string;
  type: 'payment' | 'overdue' | 'maintenance';
  message: string;
  timestamp: Date;
  amount?: number;
  tenantId?: string;
  propertyId?: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private unitService = inject(UnitService);
  private tenantService = inject(TenantService);
  private paymentService = inject(PaymentService);
  private maintenanceService = inject(MaintenanceService);
  private expenseService = inject(ExpenseService);

  getStats(): Observable<DashboardStats> {
    const user = this.auth.currentUser();
    if (!user) {
      return of(this.emptyStats());
    }

    if (isTenant(user.role) && isTenancyLinked(user)) {
      return this.paymentService.getByTenant(user.tenantRecordId!).pipe(
        switchMap((payments) =>
          this.propertyService.getById(user.linkedPropertyId!).pipe(
            map((property) => ({
              ...this.emptyStats(),
              currency: property?.currency ?? 'GMD',
              pendingPaymentReports: countPendingPaymentReports(payments),
            }))
          )
        ),
        catchError(() => of(this.emptyStats()))
      );
    }

    return this.propertyService.getByOwner(user.id).pipe(
      switchMap((properties) => {
        if (properties.length === 0) {
          return of(this.emptyStats());
        }

        const propertyIds = properties.map((p) => p.id);
        const currency = properties[0]?.currency ?? 'GMD';

        const unitObs = properties.map((p) => this.unitService.getByProperty(p.id));
        const tenantObs = properties.map((p) => this.tenantService.getByProperty(p.id));

        return combineLatest([
          combineLatest(unitObs),
          combineLatest(tenantObs),
          this.paymentService.getByOwnerProperties(propertyIds),
          this.maintenanceService.getByOwnerProperties(propertyIds),
          this.expenseService.getMonthlyTotal(propertyIds),
        ]).pipe(
          map(([unitGroups, tenantGroups, payments, requests, monthlyExpenses]) => {
            const units = unitGroups.flat();
            const tenants = tenantGroups.flat();
            const now = new Date();
            const monthStart = getMonthStart(now);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            const collectedThisMonth = sumRentCredits(payments, { monthStart, now });
            const expectedMonthlyRent = calculateExpectedMonthlyRent(units, tenants);
            const toCollect = calculateToCollect(units, payments, { tenants, now });

            const collectedLastMonth = sumConfirmedCollected(payments, lastMonthStart, monthStart);

            const outstandingRent = calculateOutstandingRent(tenants, payments, now);
            const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            const outstandingLastMonth = calculateOutstandingRent(
              tenants,
              payments,
              lastMonthRef
            );
            const discount = calculateMonthlyDiscount(units, tenants);
            const pendingRequests = requests.filter((r) => r.status !== 'completed').length;
            const pendingPaymentReports = countPendingPaymentReports(payments);

            return {
              collectedThisMonth,
              expectedMonthlyRent,
              toCollect,
              outstandingRent,
              occupiedUnits: units.filter((u) => u.status === 'occupied').length,
              vacantUnits: units.filter((u) => u.status === 'vacant').length,
              totalUnits: units.length,
              pendingRequests,
              pendingPaymentReports,
              monthlyExpenses,
              currency,
              collectedTrend: this.percentChange(collectedThisMonth, collectedLastMonth),
              outstandingTrend: this.percentChange(outstandingRent, outstandingLastMonth),
              monthlyDiscount: discount.totalDiscount,
              listedRent: discount.listedRent,
              quotedRent: discount.quotedRent,
              discountedTenants: discount.discountedTenants,
            };
          })
        );
      }),
      catchError(() => of(this.emptyStats()))
    );
  }

  getRecentActivity(): Observable<ActivityItem[]> {
    const user = this.auth.currentUser();
    if (!user) return of([]);

    if (isTenant(user.role) && isTenancyLinked(user)) {
      return this.paymentService.getByTenant(user.tenantRecordId!).pipe(
        map((payments) =>
          payments.slice(0, 10).map((p) => ({
            id: p.id,
            type: 'payment' as const,
            message:
              p.status === 'pending_verification'
                ? `Payment reported — D${p.amount.toLocaleString()} (${PAYMENT_METHOD_LABELS[p.method]})`
                : `Payment ${p.status} — D${p.amount.toLocaleString()}`,
            timestamp: p.date,
            amount: p.amount,
            tenantId: p.tenantId,
            propertyId: p.propertyId,
          }))
        ),
        catchError(() => of([]))
      );
    }

    return this.propertyService.getByOwner(user.id).pipe(
      switchMap((properties) => {
        const propertyIds = properties.map((p) => p.id);
        if (propertyIds.length === 0) return of([]);

        return combineLatest([
          this.paymentService.getByOwnerProperties(propertyIds),
          this.maintenanceService.getByOwnerProperties(propertyIds),
        ]).pipe(
          map(([payments, requests]) => {
            const paymentItems: ActivityItem[] = payments.slice(0, 8).map((p) => ({
              id: p.id,
              type: 'payment' as const,
              message: p.reportedByTenant
                ? `Tenant reported D${p.amount.toLocaleString()} via ${PAYMENT_METHOD_LABELS[p.method]}`
                : `Payment recorded — D${p.amount.toLocaleString()}`,
              timestamp: p.date,
              amount: p.amount,
              tenantId: p.tenantId,
              propertyId: p.propertyId,
            }));

            const maintenanceItems: ActivityItem[] = requests.slice(0, 5).map((r) => ({
              id: r.id,
              type: 'maintenance' as const,
              message: `Maintenance: ${r.title}`,
              timestamp: r.createdAt,
              propertyId: r.propertyId,
            }));

            return [...paymentItems, ...maintenanceItems]
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .slice(0, 10);
          })
        );
      }),
      catchError(() => of([]))
    );
  }

  private emptyStats(): DashboardStats {
    return {
      collectedThisMonth: 0,
      expectedMonthlyRent: 0,
      toCollect: 0,
      outstandingRent: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      totalUnits: 0,
      pendingRequests: 0,
      pendingPaymentReports: 0,
      monthlyExpenses: 0,
      currency: 'GMD',
      collectedTrend: 0,
      outstandingTrend: 0,
      monthlyDiscount: 0,
      listedRent: 0,
      quotedRent: 0,
      discountedTenants: 0,
    };
  }

  private percentChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 100);
  }

}
