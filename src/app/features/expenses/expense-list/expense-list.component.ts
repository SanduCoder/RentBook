import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '../../../core/models/expense.model';
import { ExpenseService } from '../../../core/services/expense.service';
import { PropertyService } from '../../../core/services/property.service';
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
}

interface ExpenseListData {
  currency: string;
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

  categoryLabels = EXPENSE_CATEGORY_LABELS;

  expenses$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '').pipe(
    switchMap((properties) => {
      const propertyMap = new Map(properties.map((p) => [p.id, p.name]));
      const currency = properties[0]?.currency ?? 'GMD';
      return this.expenseService.getByOwnerProperties(properties.map((p) => p.id)).pipe(
        map((expenses) => ({
          currency,
          items: expenses.map((e) => ({
            ...e,
            propertyName: propertyMap.get(e.propertyId) ?? 'Unknown',
          })),
          total: expenses.reduce((sum, e) => sum + e.amount, 0),
        }))
      );
    })
  );

  countByCategory(items: ExpenseListItem[], category: ExpenseCategory): number {
    return items.filter((expense) => expense.category === category).length;
  }

  categoryClass(category: ExpenseCategory): string {
    return `thumb-${category}`;
  }
}
