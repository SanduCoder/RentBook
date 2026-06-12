import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';
import { listItemDomId, scrollToListItem } from '../../../core/utils/list-focus.utils';
import { AuthService } from '../../../core/services/auth.service';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  Payment,
} from '../../../core/models/payment.model';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { isTenancyLinked } from '../../../core/utils/role.utils';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

interface MyPaymentsData {
  currency: string;
  items: Payment[];
}

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    RouterLink,
    EmptyStateComponent,
    CurrencyFormatPipe,
  ],
  templateUrl: './my-payments.component.html',
  styleUrl: './my-payments.component.scss',
})
export class MyPaymentsComponent implements OnInit {
  private auth = inject(AuthService);
  private paymentService = inject(PaymentService);
  private propertyService = inject(PropertyService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  methodLabels = PAYMENT_METHOD_LABELS;
  statusLabels = PAYMENT_STATUS_LABELS;
  paymentDomId = (id: string) => listItemDomId('payment', id);

  payments$ = of(this.auth.currentUser()).pipe(
    switchMap((user) => {
      if (!user?.tenantRecordId || !isTenancyLinked(user)) {
        return of({ currency: 'GMD', items: [] } satisfies MyPaymentsData);
      }

      return this.paymentService.getByTenant(user.tenantRecordId!).pipe(
        switchMap((items) =>
          this.propertyService.getById(user.linkedPropertyId!).pipe(
            map((property) => ({
              currency: property?.currency ?? 'GMD',
              items,
            })),
            catchError(() => of({ currency: 'GMD', items }))
          )
        ),
        catchError(() => of({ currency: 'GMD', items: [] } satisfies MyPaymentsData))
      );
    })
  );

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => !!id),
        switchMap((id) =>
          this.payments$.pipe(
            filter((data) => data.items.some((payment) => payment.id === id)),
            take(1),
            map(() => id)
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((id) => scrollToListItem(this.paymentDomId(id)));
  }

  pendingCount(items: Payment[]): number {
    return items.filter((p) => p.status === 'pending_verification').length;
  }
}
