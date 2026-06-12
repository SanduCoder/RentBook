import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { ExpenseService } from './expense.service';
import { MaintenanceService } from './maintenance.service';
import { PaymentService } from './payment.service';
import { PropertyService } from './property.service';
import { TenantService } from './tenant.service';
import { UnitService } from './unit.service';
import { defaultCurrency } from '../config/country-profiles.config';
import { propertyCountryCode, resolveOwnerListCurrency } from '../utils/currency-aggregation.utils';
import { paymentMethodLabel, paymentRecordedByLabel, PAYMENT_STATUS_LABELS } from '../models/payment.model';
import { formatCurrency, getMonthStart } from '../utils/firestore.utils';
import {
  calculateExpectedMonthlyRent,
  calculateMonthlyDiscount,
  calculateOutstandingRent,
  calculateVacantRentLoss,
  countPendingPaymentReports,
  sumConfirmedCollected,
  sumRentCredits,
} from '../utils/payment-stats.utils';
import { isTenant, isTenancyLinked } from '../utils/role.utils';
import { PropertyRentDueSummary, getPropertyRentDueSummary } from '../utils/tenant-status.utils';

export interface DashboardStats {
  collectedThisMonth: number;
  expectedMonthlyRent: number;
  outstandingRent: number;
  occupiedUnits: number;
  vacantUnits: number;
  vacantRentLoss: number;
  totalUnits: number;
  occupancyRate: number;
  pendingRequests: number;
  pendingPaymentReports: number;
  monthlyExpenses: number;
  currency: string;
  countryCode: string;
  mixedCurrencies: boolean;
  collectedTrend: number;
  outstandingTrend: number;
  monthlyDiscount: number;
  listedRent: number;
  quotedRent: number;
  discountedTenants: number;
  rentDue: PropertyRentDueSummary;
  propertyCount: number;
  singlePropertyId: string | null;
}

export interface ActivityItem {
  id: string;
  type: 'payment' | 'overdue' | 'maintenance';
  message: string;
  detail?: string;
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
    return toObservable(this.auth.currentUser).pipe(
      switchMap((user) => {
        if (!user) {
          return of(this.emptyStats());
        }

        if (isTenant(user.role) && isTenancyLinked(user)) {
          return this.paymentService.getByTenant(user.tenantRecordId!).pipe(
            switchMap((payments) =>
              this.propertyService.getById(user.linkedPropertyId!).pipe(
                map((property) => ({
                  ...this.emptyStats(user.countryCode),
                  currency: property?.currency ?? defaultCurrency(user.countryCode),
                  pendingPaymentReports: countPendingPaymentReports(payments),
                }))
              )
            ),
            catchError(() => of(this.emptyStats(user.countryCode)))
          );
        }

        return this.propertyService.getByOwner(user.id).pipe(
          switchMap((properties) => {
            if (properties.length === 0) {
              return of({
                ...this.emptyStats(user.countryCode),
                propertyCount: 0,
                singlePropertyId: null,
              });
            }

        const propertyIds = properties.map((p) => p.id);
        const currencyContext = resolveOwnerListCurrency(properties, user.countryCode);
        const currency = currencyContext.currency;
        const propertyCount = properties.length;
        const singlePropertyId = propertyCount === 1 ? properties[0].id : null;

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
            const unitNames = new Map(units.map((u) => [u.id, u.name]));
            const totalUnits = units.length;
            const occupiedUnits = units.filter((u) => u.status === 'occupied').length;

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
              outstandingRent,
              occupiedUnits,
              vacantUnits: units.filter((u) => u.status === 'vacant').length,
              vacantRentLoss: calculateVacantRentLoss(units),
              totalUnits,
              occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
              pendingRequests,
              pendingPaymentReports,
              monthlyExpenses,
              currency,
              countryCode: properties[0] ? propertyCountryCode(properties[0]) : user.countryCode ?? 'GM',
              mixedCurrencies: currencyContext.mixedCurrencies,
              collectedTrend: this.percentChange(collectedThisMonth, collectedLastMonth),
              outstandingTrend: this.percentChange(outstandingRent, outstandingLastMonth),
              monthlyDiscount: discount.totalDiscount,
              listedRent: discount.listedRent,
              quotedRent: discount.quotedRent,
              discountedTenants: discount.discountedTenants,
              rentDue: getPropertyRentDueSummary(tenants, unitNames, payments, now),
              propertyCount,
              singlePropertyId,
            };
          })
            );
          }),
          catchError(() => of(this.emptyStats(user.countryCode)))
        );
      })
    );
  }

  getRecentActivity(): Observable<ActivityItem[]> {
    return toObservable(this.auth.currentUser).pipe(
      switchMap((user) => {
        if (!user) return of([]);

        if (isTenant(user.role) && isTenancyLinked(user)) {
      return this.paymentService.getByTenant(user.tenantRecordId!).pipe(
        switchMap((payments) =>
          this.propertyService.getById(user.linkedPropertyId!).pipe(
            map((property) => {
              const currency = property?.currency ?? defaultCurrency(user.countryCode);
              return payments.slice(0, 10).map((p) => ({
                id: p.id,
                type: 'payment' as const,
                message:
                  p.status === 'pending_verification'
                    ? `Payment reported — ${formatCurrency(p.amount, currency)} (${paymentMethodLabel(p.method)})`
                    : `Payment ${PAYMENT_STATUS_LABELS[p.status] ?? p.status} — ${formatCurrency(p.amount, currency)}`,
                detail: paymentRecordedByLabel(p, {
                  viewer: 'tenant',
                  tenantUserId: user.id,
                  ownerId: property?.ownerId ?? user.linkedOwnerId,
                }),
                timestamp: p.date,
                amount: p.amount,
                tenantId: p.tenantId,
                propertyId: p.propertyId,
              }));
            })
          )
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
            const currencyByProperty = new Map(properties.map((property) => [property.id, property.currency]));
            const fallbackCurrency = defaultCurrency(user.countryCode);

            const paymentItems: ActivityItem[] = payments.slice(0, 8).map((p) => {
              const currency = currencyByProperty.get(p.propertyId) ?? fallbackCurrency;
              const amountLabel = formatCurrency(p.amount, currency);
              return {
                id: p.id,
                type: 'payment' as const,
                message: p.reportedByTenant
                  ? `Tenant reported ${amountLabel} via ${paymentMethodLabel(p.method)}`
                  : `Payment recorded — ${amountLabel}`,
                detail: paymentRecordedByLabel(p, { viewer: 'owner', ownerId: user.id }),
                timestamp: p.date,
                amount: p.amount,
                tenantId: p.tenantId,
                propertyId: p.propertyId,
              };
            });

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
      })
    );
  }

  private emptyStats(countryCode?: string | null): DashboardStats {
    return {
      collectedThisMonth: 0,
      expectedMonthlyRent: 0,
      outstandingRent: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      vacantRentLoss: 0,
      totalUnits: 0,
      occupancyRate: 0,
      pendingRequests: 0,
      pendingPaymentReports: 0,
      monthlyExpenses: 0,
      currency: defaultCurrency(countryCode),
      countryCode: countryCode ?? 'GM',
      mixedCurrencies: false,
      collectedTrend: 0,
      outstandingTrend: 0,
      monthlyDiscount: 0,
      listedRent: 0,
      quotedRent: 0,
      discountedTenants: 0,
      rentDue: { nearest: null, dueThisWeekCount: 0 },
      propertyCount: 0,
      singlePropertyId: null,
    };
  }

  private percentChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 100);
  }

}
