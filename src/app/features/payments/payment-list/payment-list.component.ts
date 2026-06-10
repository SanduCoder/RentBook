import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Payment, PaymentStatus } from '../../../core/models/payment.model';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { PAYMENT_METHOD_LABELS } from '../../../core/models/payment.model';
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

  methodLabels = PAYMENT_METHOD_LABELS;

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
}
