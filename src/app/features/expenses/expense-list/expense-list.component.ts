import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { resolveOwnerListCurrency } from '../../../core/utils/currency-aggregation.utils';
import { AuthService } from '../../../core/services/auth.service';
import {
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
  ExpenseSettlementStatus,
  isTenantAssignedExpense,
  SHARE_WITH_ALL_TENANTS,
  tenantShareStatus,
} from '../../../core/models/expense.model';
import { ExpenseService } from '../../../core/services/expense.service';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Icon3dComponent } from '../../../shared/components/icon-3d/icon-3d.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

interface ExpenseListItem {
  id: string;
  propertyId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: Date;
  propertyName: string;
  /** Who this expense is shared with: undefined = nobody, 'all', or a tenant name. */
  sharedLabel?: string;
  /** Only set when assigned to one specific tenant. */
  settlementStatus?: ExpenseSettlementStatus;
  /** Per-tenant breakdown for split (all-tenant) expenses. */
  splitShares?: SplitShare[];
  /** Equal share amount per tenant for split expenses. */
  shareAmount?: number;
}

interface SplitShare {
  tenantId: string;
  name: string;
  status: ExpenseSettlementStatus;
}

interface ExpenseListData {
  currency: string;
  mixedCurrencies: boolean;
  items: ExpenseListItem[];
  total: number;
}

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, EmptyStateComponent, CurrencyFormatPipe, Icon3dComponent],
  templateUrl: './expense-list.component.html',
  styleUrl: './expense-list.component.scss',
})
export class ExpenseListComponent {
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private expenseService = inject(ExpenseService);
  private tenantService = inject(TenantService);
  private notifications = inject(ErrorNotificationService);

  categoryLabels = EXPENSE_CATEGORY_LABELS;

  expenses$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '').pipe(
    switchMap((properties) => {
      const propertyMap = new Map(properties.map((p) => [p.id, p.name]));
      const propertyIds = properties.map((p) => p.id);
      const currencyContext = resolveOwnerListCurrency(properties, this.auth.currentUser()?.countryCode);
      return combineLatest([
        this.expenseService.getByOwnerProperties(propertyIds),
        this.tenantService.getByOwnerProperties(propertyIds),
      ]).pipe(
        map(([expenses, tenants]) => {
          const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
          const activeIdsByProperty = new Map<string, string[]>();
          for (const t of tenants) {
            if (t.active === false) continue;
            const ids = activeIdsByProperty.get(t.propertyId) ?? [];
            ids.push(t.id);
            activeIdsByProperty.set(t.propertyId, ids);
          }

          return {
            currency: currencyContext.currency,
            mixedCurrencies: currencyContext.mixedCurrencies,
            items: expenses.map((e) => {
              const isAllShare =
                !!e.visibleToTenants &&
                (!e.sharedWithTenantId || e.sharedWithTenantId === SHARE_WITH_ALL_TENANTS);
              // Use the saved split snapshot, or fall back to the property's current tenants.
              const splitIds = isAllShare
                ? e.splitTenantIds?.length
                  ? e.splitTenantIds
                  : activeIdsByProperty.get(e.propertyId) ?? []
                : [];
              const splitShares =
                splitIds.length > 0
                  ? splitIds.map((tenantId) => ({
                      tenantId,
                      name: tenantMap.get(tenantId) ?? 'Tenant',
                      status: tenantShareStatus(e, tenantId),
                    }))
                  : undefined;

              return {
                ...e,
                propertyName: propertyMap.get(e.propertyId) ?? 'Unknown',
                sharedLabel: this.resolveSharedLabel(e, tenantMap),
                settlementStatus: isTenantAssignedExpense(e) ? e.settlementStatus ?? 'unpaid' : undefined,
                shareAmount: splitShares ? e.amount / splitShares.length : undefined,
                splitShares,
              };
            }),
            total: expenses.reduce((sum, e) => sum + e.amount, 0),
          };
        })
      );
    })
  );

  private resolveSharedLabel(
    expense: { visibleToTenants?: boolean; sharedWithTenantId?: string },
    tenantMap: Map<string, string>
  ): string | undefined {
    if (!expense.visibleToTenants) return undefined;
    if (!expense.sharedWithTenantId || expense.sharedWithTenantId === SHARE_WITH_ALL_TENANTS) {
      return 'All tenants';
    }
    return tenantMap.get(expense.sharedWithTenantId) ?? 'A tenant';
  }

  async confirmPaid(expenseId: string): Promise<void> {
    try {
      await this.expenseService.confirmPaid(expenseId);
      this.notifications.success('Marked as paid.');
    } catch (err) {
      this.notifications.handleError(err, 'Could not update this expense. Try again.');
    }
  }

  async markUnpaid(expenseId: string): Promise<void> {
    try {
      await this.expenseService.markUnpaid(expenseId);
    } catch (err) {
      this.notifications.handleError(err, 'Could not update this expense. Try again.');
    }
  }

  async setShare(
    expenseId: string,
    tenantId: string,
    status: 'unpaid' | 'paid'
  ): Promise<void> {
    try {
      await this.expenseService.setShareStatus(expenseId, tenantId, status);
      if (status === 'paid') {
        this.notifications.success('Marked as paid.');
      }
    } catch (err) {
      this.notifications.handleError(err, 'Could not update this expense. Try again.');
    }
  }

  countByCategory(items: ExpenseListItem[], category: ExpenseCategory): number {
    return items.filter((expense) => expense.category === category).length;
  }

  categoryClass(category: ExpenseCategory): string {
    return `thumb-${category}`;
  }
}
