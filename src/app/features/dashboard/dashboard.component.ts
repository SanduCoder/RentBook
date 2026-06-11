import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { Property } from '../../core/models/property.model';
import { AuthService } from '../../core/services/auth.service';
import { ErrorNotificationService } from '../../core/services/error-notification.service';
import { PropertyService } from '../../core/services/property.service';
import { RentReminderService } from '../../core/services/rent-reminder.service';
import { ActivityItem, DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { dashboardActivityLink } from '../../core/utils/activity.utils';
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
  private rentReminders = inject(RentReminderService);
  private notifications = inject(ErrorNotificationService);

  user = this.auth.currentUser;
  stats$ = this.dashboard.getStats();
  activity$ = this.dashboard.getRecentActivity();
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

  private tenantQuickActions: QuickAction[] = [
    {
      id: 'report-payment',
      route: '/payments/report',
      title: 'Report Payment',
      subtitle: 'Wave, AfriMoney, cash & more',
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

  quickActions$ = toObservable(this.user).pipe(
    switchMap((user) => {
      if (!user) return of([] as QuickAction[]);

      if (!canManageTenants(user.role)) {
        if (hasPendingTenancyLink(user)) {
          return of([
            {
              id: 'complete-setup',
              route: '/join',
              title: 'Complete Setup',
              subtitle: 'Enter your property code',
              icon: 'properties' as Icon3dName,
              tone: 'green' as const,
            },
            ...this.tenantQuickActions,
          ]);
        }
        return of(this.tenantQuickActions);
      }

      return this.propertyService.getByOwner(user.id).pipe(
        map((properties) => this.buildManagerQuickActions(properties))
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
      const prefix = stats.currency === 'GMD' ? 'D' : `${stats.currency} `;
      parts.push(`${prefix}${stats.outstandingRent.toLocaleString()} outstanding`);
    }

    if (stats.pendingPaymentReports > 0) {
      parts.push(`${stats.pendingPaymentReports} payment(s) to verify`);
    }

    return parts.length ? parts.join(' · ') : null;
  }

  collectedTrendLabel(stats: DashboardStats): string {
    if (stats.pendingPaymentReports > 0) {
      return 'incl. pending verification';
    }
    if (stats.collectedThisMonth === 0) {
      return 'No payments received';
    }
    return this.trendLabel(stats.collectedTrend);
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

  async sendRentReminder(due: RentDueTenant, currency: string): Promise<void> {
    const user = this.user();
    if (!user) return;

    try {
      await this.rentReminders.sendFromDue(due, currency, {
        id: user.id,
        name: user.name?.trim() || 'Your landlord',
      });
      this.notifications.success('Reminder saved in RentBook and sent via WhatsApp.');
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
    if (item.type === 'maintenance') return '💧';
    if (item.type === 'overdue') return '🏠';
    return '👤';
  }

  activityStatus(item: ActivityItem): 'success' | 'warning' | 'info' {
    if (item.type === 'maintenance') return 'info';
    if (item.type === 'overdue') return 'warning';
    return 'success';
  }

  activityLink = dashboardActivityLink;

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
