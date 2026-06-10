import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ActivityItem, DashboardService } from '../../core/services/dashboard.service';
import { dashboardActivityLink } from '../../core/utils/activity.utils';
import { canManageTenants, hasPendingTenancyLink } from '../../core/utils/role.utils';
import { Icon3dComponent, Icon3dName } from '../../shared/components/icon-3d/icon-3d.component';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';

interface QuickAction {
  route: string;
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

  user = this.auth.currentUser;
  stats$ = this.dashboard.getStats();
  activity$ = this.dashboard.getRecentActivity();
  canManage = computed(() => canManageTenants(this.user()?.role));
  pendingTenancyLink = computed(() => hasPendingTenancyLink(this.user()));

  private managerQuickActions: QuickAction[] = [
    {
      route: '/properties/new',
      title: 'Add Property',
      subtitle: 'Register new property',
      icon: 'properties',
      tone: 'green',
    },
    {
      route: '/payments/new',
      title: 'Record Payment',
      subtitle: 'Record tenant payment',
      icon: 'collected',
      tone: 'orange',
    },
    {
      route: '/expenses/new',
      title: 'Add Expense',
      subtitle: 'Track your expenses',
      icon: 'expenses',
      tone: 'purple',
    },
    {
      route: '/shared-bills/new',
      title: 'Shared Bill',
      subtitle: 'Manage shared bills',
      icon: 'bills',
      tone: 'blue',
    },
  ];

  private tenantQuickActions: QuickAction[] = [
    {
      route: '/requests/new',
      title: 'Report Issue',
      subtitle: 'Submit a maintenance request',
      icon: 'requests',
      tone: 'blue',
    },
    {
      route: '/requests',
      title: 'My Requests',
      subtitle: 'View request status',
      icon: 'pending',
      tone: 'orange',
    },
  ];

  quickActions = computed(() => {
    if (this.canManage()) return this.managerQuickActions;

    if (this.pendingTenancyLink()) {
      return [
        {
          route: '/join',
          title: 'Complete Setup',
          subtitle: 'Enter your property code',
          icon: 'properties' as Icon3dName,
          tone: 'green' as const,
        },
        ...this.tenantQuickActions,
      ];
    }

    return this.tenantQuickActions;
  });

  greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning 👋';
    if (hour < 17) return 'Good Afternoon 👋';
    return 'Good Evening 👋';
  }

  displayName(): string {
    const name = this.user()?.name?.trim();
    if (!name) return this.canManage() ? 'Owner' : 'Tenant';
    return name.split(/\s+/)[0];
  }

  trendLabel(value: number): string {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${value}% from last month`;
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
}
