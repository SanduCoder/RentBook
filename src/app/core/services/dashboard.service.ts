import { Injectable, inject } from '@angular/core';
import { catchError, combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import { ExpenseService } from './expense.service';
import { MaintenanceService } from './maintenance.service';
import { PaymentService } from './payment.service';
import { PropertyService } from './property.service';
import { TenantService } from './tenant.service';
import { UnitService } from './unit.service';
import { Payment } from '../models/payment.model';
import { getMonthStart } from '../utils/firestore.utils';

export interface DashboardStats {
  collectedThisMonth: number;
  outstandingRent: number;
  occupiedUnits: number;
  vacantUnits: number;
  totalUnits: number;
  pendingRequests: number;
  monthlyExpenses: number;
  currency: string;
  collectedTrend: number;
  outstandingTrend: number;
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

            const collectedThisMonth = payments
              .filter((p) => p.date >= monthStart && p.status === 'paid')
              .reduce((sum, p) => sum + p.amount, 0);

            const collectedLastMonth = payments
              .filter(
                (p) =>
                  p.date >= lastMonthStart &&
                  p.date < monthStart &&
                  p.status === 'paid'
              )
              .reduce((sum, p) => sum + p.amount, 0);

            const outstandingRent = this.calculateOutstanding(tenants, payments, now);
            const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            const outstandingLastMonth = this.calculateOutstanding(
              tenants,
              payments,
              lastMonthRef
            );
            const pendingRequests = requests.filter((r) => r.status !== 'completed').length;

            return {
              collectedThisMonth,
              outstandingRent,
              occupiedUnits: units.filter((u) => u.status === 'occupied').length,
              vacantUnits: units.filter((u) => u.status === 'vacant').length,
              totalUnits: units.length,
              pendingRequests,
              monthlyExpenses,
              currency,
              collectedTrend: this.percentChange(collectedThisMonth, collectedLastMonth),
              outstandingTrend: this.percentChange(outstandingRent, outstandingLastMonth),
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
              message: `Payment recorded — D${p.amount.toLocaleString()}`,
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
      outstandingRent: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      totalUnits: 0,
      pendingRequests: 0,
      monthlyExpenses: 0,
      currency: 'GMD',
      collectedTrend: 0,
      outstandingTrend: 0,
    };
  }

  private percentChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 100);
  }

  private calculateOutstanding(
    tenants: { id: string; monthlyRent: number; dueDay: number }[],
    payments: Payment[],
    now = new Date()
  ): number {
    const monthStart = getMonthStart(now);

    return tenants.reduce((total, tenant) => {
      const paidThisMonth = payments
        .filter(
          (p) =>
            p.tenantId === tenant.id &&
            p.date >= monthStart &&
            (p.status === 'paid' || p.status === 'partial')
        )
        .reduce((sum, p) => sum + p.amount, 0);

      const due = now.getDate() >= tenant.dueDay;
      if (due && paidThisMonth < tenant.monthlyRent) {
        return total + (tenant.monthlyRent - paidThisMonth);
      }
      return total;
    }, 0);
  }
}
