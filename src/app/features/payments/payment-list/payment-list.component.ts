import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filter, map, switchMap, take } from 'rxjs';
import { listItemDomId, scrollToListItem } from '../../../core/utils/list-focus.utils';
import {
  showListCollapse,
  showListExpand,
  visibleListItems,
} from '../../../core/utils/list-preview.utils';
import { CountryProfileService } from '../../../core/services/country-profile.service';
import { resolveOwnerListCurrency } from '../../../core/utils/currency-aggregation.utils';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  Payment,
  PaymentStatus,
  paymentRecordedAt,
  paymentRecordedByLabel,
} from '../../../core/models/payment.model';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Icon3dComponent } from '../../../shared/components/icon-3d/icon-3d.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

interface PaymentListData {
  currency: string;
  mixedCurrencies: boolean;
  items: Payment[];
}

@Component({
  selector: 'app-payment-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, EmptyStateComponent, CurrencyFormatPipe, Icon3dComponent],
  templateUrl: './payment-list.component.html',
  styleUrl: './payment-list.component.scss',
})
export class PaymentListComponent implements OnInit {
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private paymentService = inject(PaymentService);
  private notifications = inject(ErrorNotificationService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private countryProfiles = inject(CountryProfileService);

  methodLabels = PAYMENT_METHOD_LABELS;
  paymentMethodsHint = this.countryProfiles.paymentMethodsLabel(this.auth.currentUser()?.countryCode);
  statusLabels = PAYMENT_STATUS_LABELS;
  actionPaymentId = signal<string | null>(null);
  listExpanded = signal(false);
  visiblePayments = visibleListItems;
  showPaymentsExpand = showListExpand;
  showPaymentsCollapse = showListCollapse;
  paymentDomId = (id: string) => listItemDomId('payment', id);
  recordedAt = paymentRecordedAt;

  payments$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '').pipe(
    switchMap((properties) => {
      const currencyContext = resolveOwnerListCurrency(properties, this.auth.currentUser()?.countryCode);
      return this.paymentService.getByOwnerProperties(properties.map((p) => p.id)).pipe(
        map((items) => ({
          currency: currencyContext.currency,
          mixedCurrencies: currencyContext.mixedCurrencies,
          items,
        }))
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
      .subscribe((id) => {
        this.listExpanded.set(true);
        scrollToListItem(this.paymentDomId(id));
      });
  }

  totalAmount(data: PaymentListData): number {
    return data.items.reduce((sum, payment) => sum + payment.amount, 0);
  }

  countByStatus(items: Payment[], status: PaymentStatus): number {
    return items.filter((payment) => payment.status === status).length;
  }

  async confirmPayment(payment: Payment): Promise<void> {
    this.actionPaymentId.set(payment.id);
    try {
      const status = payment.amount > 0 ? 'paid' : 'partial';
      await this.paymentService.confirmPayment(payment.id, status);
      this.notifications.success('Payment confirmed.');
    } catch (err) {
      this.notifications.handleError(err, 'Could not confirm payment.');
    } finally {
      this.actionPaymentId.set(null);
    }
  }

  async rejectPayment(payment: Payment): Promise<void> {
    if (!confirm('Reject this reported payment?')) return;

    this.actionPaymentId.set(payment.id);
    try {
      await this.paymentService.rejectReportedPayment(payment.id);
      this.notifications.success('Reported payment removed.');
    } catch (err) {
      this.notifications.handleError(err, 'Could not reject payment.');
    } finally {
      this.actionPaymentId.set(null);
    }
  }

  recordedByLabel(payment: Payment): string {
    const user = this.auth.currentUser();
    return paymentRecordedByLabel(payment, user ? { viewer: 'owner', ownerId: user.id } : undefined);
  }
}
