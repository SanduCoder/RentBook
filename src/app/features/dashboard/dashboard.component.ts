import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { Property } from '../../core/models/property.model';
import { formatUnitLayout } from '../../core/models/unit.model';
import { maintenanceCategoryIcon } from '../../core/models/maintenance.model';
import { defaultCurrency } from '../../core/config/country-profiles.config';
import {
  Expense,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SETTLEMENT_LABELS,
  ExpenseSettlementStatus,
  expenseShareAmount,
  isSplitExpense,
  isTenantAssignedExpense,
  tenantShareStatus,
} from '../../core/models/expense.model';
import { AuthService } from '../../core/services/auth.service';
import { ErrorNotificationService } from '../../core/services/error-notification.service';
import { ExpenseService } from '../../core/services/expense.service';
import { PropertyService } from '../../core/services/property.service';
import { TenantService } from '../../core/services/tenant.service';
import { UnitService } from '../../core/services/unit.service';
import { RentReminderService } from '../../core/services/rent-reminder.service';
import { ActivityItem, DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { CountryProfileService } from '../../core/services/country-profile.service';
import { dashboardActivityLink } from '../../core/utils/activity.utils';
import { formatCurrency } from '../../core/utils/firestore.utils';
import { canManageTenants, hasPendingTenancyLink, isTenancyLinked } from '../../core/utils/role.utils';
import { RentDueTenant } from '../../core/utils/tenant-status.utils';
import { Icon3dComponent, Icon3dName } from '../../shared/components/icon-3d/icon-3d.component';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';

interface QuickAction {
  id: string;
  route: string;
  queryParams?: Record<string, string>;
  title: string;
  subtitle: string;
  icon: Icon3dName;
  tone: 'green' | 'orange' | 'purple' | 'blue';
}

interface TenantHome {
  propertyName: string;
  address: string;
  unitName: string;
  unitLayout: string;
  monthlyRent: number;
  currency: string;
  dueDay: number;
  moveInDate: Date;
}

interface SharedExpenses {
  currency: string;
  items: Expense[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, CurrencyFormatPipe, Icon3dComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private auth = inject(AuthService);
  private dashboard = inject(DashboardService);
  private propertyService = inject(PropertyService);
  private tenantService = inject(TenantService);
  private unitService = inject(UnitService);
  private expenseService = inject(ExpenseService);
  private rentReminders = inject(RentReminderService);
  private notifications = inject(ErrorNotificationService);
  private countryProfiles = inject(CountryProfileService);

  expenseCategoryLabels = EXPENSE_CATEGORY_LABELS;
  expenseSettlementLabels = EXPENSE_SETTLEMENT_LABELS;
  user = this.auth.currentUser;
  stats$ = this.dashboard.getStats();
  activity$ = this.dashboard.getRecentActivity();
  tenantHome$ = toObservable(this.user).pipe(
    switchMap((user) => {
      if (!user || !isTenancyLinked(user) || !user.tenantRecordId) {
        return of(null as TenantHome | null);
      }

      return this.tenantService.getById(user.tenantRecordId).pipe(
        switchMap((tenant) => {
          if (!tenant) return of(null as TenantHome | null);

          return combineLatest([
            this.propertyService.getById(tenant.propertyId).pipe(catchError(() => of(undefined))),
            this.unitService.getById(tenant.unitId).pipe(catchError(() => of(undefined))),
          ]).pipe(
            map(
              ([property, unit]) =>
                ({
                  propertyName: property?.name ?? 'Your property',
                  address: property?.address ?? '',
                  unitName: unit?.name ?? 'Your unit',
                  unitLayout: unit ? formatUnitLayout(unit.rooms, unit.bathrooms) : '',
                  monthlyRent: tenant.monthlyRent,
                  currency: property?.currency ?? defaultCurrency(user.countryCode),
                  dueDay: tenant.dueDay,
                  moveInDate: tenant.moveInDate,
                } satisfies TenantHome)
            )
          );
        }),
        catchError(() => of(null as TenantHome | null))
      );
    })
  );
  sharedExpenses$ = toObservable(this.user).pipe(
    switchMap((user) => {
      if (!user || !isTenancyLinked(user) || !user.linkedPropertyId || !user.tenantRecordId) {
        return of(null as SharedExpenses | null);
      }

      const propertyId = user.linkedPropertyId;
      return combineLatest([
        this.expenseService
          .getVisibleByProperty(propertyId, user.tenantRecordId)
          .pipe(catchError(() => of([] as Expense[]))),
        this.propertyService.getById(propertyId).pipe(catchError(() => of(undefined))),
      ]).pipe(
        map(
          ([items, property]) =>
            ({
              currency: property?.currency ?? defaultCurrency(user.countryCode),
              items: items.slice(0, 5),
            } satisfies SharedExpenses)
        ),
        catchError(() => of(null as SharedExpenses | null))
      );
    })
  );
  tenantReminders$ = toObservable(this.user).pipe(
    switchMap((user) => {
      if (!user || !isTenancyLinked(user)) {
        return of([]);
      }
      return this.rentReminders.getUnreadForTenant(user.tenantRecordId!);
    })
  );
  canManage = computed(() => canManageTenants(this.user()?.role));
  pendingTenancyLink = computed(() => hasPendingTenancyLink(this.user()));

  private tenantQuickActions(userCountryCode?: string): QuickAction[] {
    return [
      {
        id: 'report-payment',
        route: '/payments/report',
        title: 'Report Payment',
        subtitle: this.countryProfiles.paymentMethodsLabel(userCountryCode),
        icon: 'collected',
        tone: 'green',
      },
      {
        id: 'my-payments',
        route: '/my-payments',
        title: 'My Payments',
        subtitle: 'View payment history',
        icon: 'bills',
        tone: 'orange',
      },
      {
        id: 'report-issue',
        route: '/requests/new',
        title: 'Report Issue',
        subtitle: 'Submit a maintenance request',
        icon: 'requests',
        tone: 'blue',
      },
    ];
  }

  quickActions$ = toObservable(this.user).pipe(
    switchMap((user) => {
      if (!user) return of([] as QuickAction[]);

      if (!canManageTenants(user.role)) {
        return of(this.tenantQuickActions(user.countryCode));
      }

      return this.propertyService.getByOwner(user.id).pipe(
        map((properties) => this.buildManagerQuickActions(properties)),
        catchError(() => of(this.buildManagerQuickActions([])))
      );
    })
  );

  personalizedGreeting(): string {
    const hour = new Date().getHours();
    const name = this.displayName();
    if (hour < 12) return `Good Morning, ${name} 👋`;
    if (hour < 17) return `Good Afternoon, ${name} 👋`;
    return `Good Evening, ${name} 👋`;
  }

  displayName(): string {
    const name = this.user()?.name?.trim();
    if (!name) return this.canManage() ? 'Owner' : 'Tenant';
    return name.split(/\s+/)[0];
  }

  heroContext(stats: DashboardStats): string | null {
    const parts: string[] = [];

    if (stats.pendingRequests > 0) {
      const label = stats.pendingRequests === 1 ? 'request' : 'requests';
      parts.push(`${stats.pendingRequests} pending ${label}`);
    }

    if (stats.outstandingRent > 0) {
      parts.push(`${formatCurrency(stats.outstandingRent, stats.currency)} outstanding`);
    }

    if (stats.pendingPaymentReports > 0) {
      parts.push(`${stats.pendingPaymentReports} payment(s) to verify`);
    }

    return parts.length ? parts.join(' · ') : null;
  }

  collectedTrendLabel(stats: DashboardStats): string {
    if (!stats.expectedMonthlyRent) {
      if (stats.pendingPaymentReports > 0) {
        return 'incl. pending verification';
      }
      return stats.collectedThisMonth === 0 ? 'No payments received' : 'No expected rent set';
    }

    const progress = this.collectionProgress(stats);
    const base = `${progress}% of expected rent`;

    if (stats.pendingPaymentReports > 0) {
      return `${base} · incl. pending verification`;
    }

    return base;
  }

  trendLabel(value: number): string {
    if (value > 0) return `▲ +${value}% this month`;
    if (value < 0) return `▼ ${value}% this month`;
    return 'Same as last month';
  }

  collectionProgress(stats: DashboardStats): number {
    if (!stats.expectedMonthlyRent) return 0;
    return Math.min(100, Math.round((stats.collectedThisMonth / stats.expectedMonthlyRent) * 100));
  }

  async sendRentReminder(due: RentDueTenant, currency: string, countryCode?: string): Promise<void> {
    const user = this.user();
    if (!user) return;

    try {
      await this.rentReminders.sendFromDue(
        due,
        currency,
        {
          id: user.id,
          name: user.name?.trim() || 'Your landlord',
        },
        countryCode ?? user.countryCode
      );
      this.notifications.success('Reminder saved in RentBook');
    } catch {
      this.notifications.show('Could not send reminder. Try again.');
    }
  }

  async dismissReminder(reminderId: string): Promise<void> {
    try {
      await this.rentReminders.markAsRead(reminderId);
    } catch {
      this.notifications.show('Could not dismiss reminder.');
    }
  }

  activityIcon(item: ActivityItem): string {
    if (item.type === 'maintenance' && item.maintenanceCategory) {
      return maintenanceCategoryIcon(item.maintenanceCategory);
    }
    if (item.type === 'maintenance') return '🔧';
    if (item.type === 'overdue') return '🏠';
    return '👤';
  }

  activityStatus(item: ActivityItem): 'success' | 'warning' | 'info' {
    if (item.statusTone) return item.statusTone;
    if (item.type === 'maintenance') return 'info';
    if (item.type === 'overdue') return 'warning';
    return 'success';
  }

  activityLink = dashboardActivityLink;

  /** True when this shared expense is assigned to the current tenant specifically. */
  isAssignedToMe(expense: Expense): boolean {
    return (
      isTenantAssignedExpense(expense) &&
      expense.sharedWithTenantId === this.user()?.tenantRecordId
    );
  }

  /** True when this is a split expense the current tenant is part of. */
  isMySplit(expense: Expense): boolean {
    const tenantId = this.user()?.tenantRecordId;
    return !!tenantId && isSplitExpense(expense) && (expense.splitTenantIds?.includes(tenantId) ?? false);
  }

  /** The amount the current tenant owes for this expense (full or split share). */
  myAmount(expense: Expense): number {
    return this.isMySplit(expense) ? expenseShareAmount(expense) : expense.amount;
  }

  /** The current tenant's settlement status for this expense. */
  myStatus(expense: Expense): ExpenseSettlementStatus {
    const tenantId = this.user()?.tenantRecordId;
    if (this.isMySplit(expense) && tenantId) {
      return tenantShareStatus(expense, tenantId);
    }
    return expense.settlementStatus ?? 'unpaid';
  }

  /** Whether the current tenant has any payable share of this expense. */
  isPayableByMe(expense: Expense): boolean {
    return this.isAssignedToMe(expense) || this.isMySplit(expense);
  }

  async markExpensePaid(expense: Expense): Promise<void> {
    const tenantId = this.user()?.tenantRecordId;
    try {
      if (this.isMySplit(expense) && tenantId) {
        await this.expenseService.setShareStatus(expense.id, tenantId, 'pending_confirmation');
      } else {
        await this.expenseService.tenantMarkPaid(expense.id);
      }
      this.notifications.success('Marked as paid. Your landlord will confirm it.');
    } catch (err) {
      this.notifications.handleError(err, 'Could not update this expense. Try again.');
    }
  }

  async undoExpensePaid(expense: Expense): Promise<void> {
    const tenantId = this.user()?.tenantRecordId;
    try {
      if (this.isMySplit(expense) && tenantId) {
        await this.expenseService.setShareStatus(expense.id, tenantId, 'unpaid');
      } else {
        await this.expenseService.tenantUndoPaid(expense.id);
      }
    } catch (err) {
      this.notifications.handleError(err, 'Could not update this expense. Try again.');
    }
  }

  private buildManagerQuickActions(properties: Property[]): QuickAction[] {
    const invite = this.inviteQuickAction(properties);

    return [
      {
        id: 'record-payment',
        route: '/payments/new',
        title: 'Record Payment',
        subtitle: 'Log rent received today',
        icon: 'collected',
        tone: 'orange',
      },
      invite,
      {
        id: 'send-reminder',
        route: '/tenants',
        title: 'Send Reminder',
        subtitle: 'Nudge tenants on WhatsApp',
        icon: 'notifications',
        tone: 'blue',
      },
      {
        id: 'add-property',
        route: '/properties/new',
        title: 'Add Property',
        subtitle: 'Register new property',
        icon: 'properties',
        tone: 'green',
      },
      {
        id: 'add-expense',
        route: '/expenses/new',
        title: 'Add Expense',
        subtitle: 'Track property costs',
        icon: 'expenses',
        tone: 'purple',
      },
    ];
  }

  private inviteQuickAction(properties: Property[]): QuickAction {
    if (properties.length === 0) {
      return {
        id: 'invite-tenant',
        route: '/properties/new',
        title: 'Invite Tenant',
        subtitle: 'Add a property first',
        icon: 'tenants',
        tone: 'green',
      };
    }

    if (properties.length === 1) {
      const property = properties[0];
      return {
        id: 'invite-tenant',
        route: `/properties/${property.id}`,
        queryParams: { tab: 'overview' },
        title: 'Invite Tenant',
        subtitle: `Share code for ${property.name}`,
        icon: 'tenants',
        tone: 'green',
      };
    }

    return {
      id: 'invite-tenant',
      route: '/properties',
      title: 'Invite Tenant',
      subtitle: 'Pick a property to share code',
      icon: 'tenants',
      tone: 'green',
    };
  }
}
