import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { Payment } from '../../../core/models/payment.model';
import { Property, PROPERTY_TYPE_LABELS } from '../../../core/models/property.model';
import { Tenant } from '../../../core/models/tenant.model';
import { Unit } from '../../../core/models/unit.model';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { RentReminderService } from '../../../core/services/rent-reminder.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UnitService } from '../../../core/services/unit.service';
import { TenantRentStatusInfo, getTenantRentStatus } from '../../../core/utils/tenant-status.utils';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { PAYMENT_METHOD_LABELS } from '../../../core/models/payment.model';

interface TenantDetailData {
  tenant: Tenant;
  payments: Payment[];
  property?: Property;
  unit?: Unit;
  rentStatus: TenantRentStatusInfo;
  currency: string;
  unitName: string;
  propertyName: string;
}

type TenantDetailState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; data: TenantDetailData };

@Component({
  selector: 'app-tenant-detail',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, CurrencyFormatPipe],
  templateUrl: './tenant-detail.component.html',
  styleUrl: './tenant-detail.component.scss',
})
export class TenantDetailComponent {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private tenantService = inject(TenantService);
  private paymentService = inject(PaymentService);
  private propertyService = inject(PropertyService);
  private unitService = inject(UnitService);
  private rentReminders = inject(RentReminderService);
  private notifications = inject(ErrorNotificationService);

  methodLabels = PAYMENT_METHOD_LABELS;
  propertyTypeLabels = PROPERTY_TYPE_LABELS;

  locationLabel(address: string): string {
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : address;
  }

  state$ = this.route.paramMap.pipe(
    map((p) => p.get('id')!),
    switchMap((id) =>
      combineLatest([
        this.tenantService.getById(id).pipe(catchError(() => of(undefined))),
        this.paymentService.getByTenant(id).pipe(catchError(() => of([] as Payment[]))),
      ]).pipe(
        switchMap(([tenant, payments]) => {
          if (!tenant) {
            return of({ status: 'missing' } satisfies TenantDetailState);
          }

          return combineLatest([
            this.propertyService.getById(tenant.propertyId).pipe(catchError(() => of(undefined))),
            this.unitService.getById(tenant.unitId).pipe(catchError(() => of(undefined))),
          ]).pipe(
            map(([property, unit]) => ({
              status: 'ready',
              data: {
                tenant,
                payments,
                property,
                unit,
                rentStatus: getTenantRentStatus(tenant, payments),
                currency: property?.currency ?? 'GMD',
                unitName: unit?.name ?? 'Unit',
                propertyName: property?.name ?? 'Property',
              },
            } satisfies TenantDetailState))
          );
        }),
        catchError(() => of({ status: 'error' } satisfies TenantDetailState)),
        startWith({ status: 'loading' } satisfies TenantDetailState)
      )
    )
  );

  whatsAppLink(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  }

  async sendReminder(data: TenantDetailData): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    try {
      await this.rentReminders.sendForTenant(
        data.tenant,
        data.unitName,
        data.currency,
        data.rentStatus,
        { id: user.id, name: user.name?.trim() || 'Your landlord' }
      );
      this.notifications.success('Reminder saved in RentBook');
    } catch {
      this.notifications.show('Could not send reminder. Try again.');
    }
  }

  scrollToHistory(): void {
    document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth' });
  }
}
