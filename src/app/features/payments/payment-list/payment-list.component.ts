import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  Payment,
  PaymentStatus,
} from '../../../core/models/payment.model';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Icon3dComponent } from '../../../shared/components/icon-3d/icon-3d.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

interface PaymentListData {
  currency: string;
  items: Payment[];
}

@Component({
  selector: 'app-payment-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, EmptyStateComponent, CurrencyFormatPipe, Icon3dComponent],
  templateUrl: './payment-list.component.html',
  styleUrl: './payment-list.component.scss',
})
export class PaymentListComponent {
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private paymentService = inject(PaymentService);
  private notifications = inject(ErrorNotificationService);

  methodLabels = PAYMENT_METHOD_LABELS;
  statusLabels = PAYMENT_STATUS_LABELS;
  actionPaymentId = signal<string | null>(null);

  payments$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '').pipe(
    switchMap((properties) => {
      const currency = properties[0]?.currency ?? 'GMD';
      return this.paymentService.getByOwnerProperties(properties.map((p) => p.id)).pipe(
        map((items) => ({ currency, items }))
      );
    })
  );

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
}
