import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { defaultCurrency } from '../../core/config/country-profiles.config';
import { resolveOwnerListCurrency } from '../../core/utils/currency-aggregation.utils';
import { AuthService } from '../../core/services/auth.service';
import { ExpenseService } from '../../core/services/expense.service';
import { PaymentService } from '../../core/services/payment.service';
import { PropertyService } from '../../core/services/property.service';
import { getMonthStart } from '../../core/utils/firestore.utils';
import { Icon3dComponent } from '../../shared/components/icon-3d/icon-3d.component';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [AsyncPipe, RouterLink, CurrencyFormatPipe, Icon3dComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private paymentService = inject(PaymentService);
  private expenseService = inject(ExpenseService);

  report$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '').pipe(
    switchMap((properties) => {
      if (properties.length === 0) {
        return of({
          currency: defaultCurrency(this.auth.currentUser()?.countryCode),
          mixedCurrencies: false,
          income: 0,
          expenses: 0,
          profit: 0,
        });
      }

      const propertyIds = properties.map((p) => p.id);
      const currencyContext = resolveOwnerListCurrency(properties, this.auth.currentUser()?.countryCode);
      const monthStart = getMonthStart();
      return combineLatest([
        this.paymentService.getByOwnerProperties(propertyIds),
        this.expenseService.getByOwnerProperties(propertyIds),
      ]).pipe(
        map(([payments, expenses]) => {
          const income = payments
            .filter((p) => p.date >= monthStart && (p.status === 'paid' || p.status === 'partial'))
            .reduce((sum, p) => sum + p.amount, 0);

          const expenseTotal = expenses
            .filter((e) => e.date >= monthStart)
            .reduce((sum, e) => sum + e.amount, 0);

          return {
            currency: currencyContext.currency,
            mixedCurrencies: currencyContext.mixedCurrencies,
            income,
            expenses: expenseTotal,
            profit: income - expenseTotal,
          };
        })
      );
    })
  );

  monthLabel(): string {
    return new Date().toLocaleString('en-US', { month: 'short' });
  }
}
