import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { Payment } from '../../../core/models/payment.model';
import { Property, PROPERTY_TYPE_LABELS } from '../../../core/models/property.model';
import { Tenant } from '../../../core/models/tenant.model';
import { Unit } from '../../../core/models/unit.model';
import { defaultCurrency } from '../../../core/config/country-profiles.config';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { RentReminderService } from '../../../core/services/rent-reminder.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UnitService } from '../../../core/services/unit.service';
import { propertyCountryCode } from '../../../core/utils/currency-aggregation.utils';
import { normalizePhone } from '../../../core/utils/phone.utils';
import { TenantRentStatusInfo, getTenantRentStatus } from '../../../core/utils/tenant-status.utils';
import { getTenantMonthBalance, TenantMonthBalance } from '../../../core/utils/payment-stats.utils';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { PAYMENT_METHOD_LABELS, paymentRecordedAt, paymentRecordedByLabel } from '../../../core/models/payment.model';

interface TenantDetailData {
  tenant: Tenant;
  payments: Payment[];
  property?: Property;
  unit?: Unit;
  rentStatus: TenantRentStatusInfo;
  monthBalance: TenantMonthBalance;
  currency: string;
  countryCode: string;
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
  recordedAt = paymentRecordedAt;

  locationLabel(address: string): string {
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : address;
  }

  state$ = this.route.paramMap.pipe(
    map((p) => p.get('id')!),
    switchMap((id) =>
      this.tenantService.getById(id).pipe(
        catchError(() => of(undefined)),
        switchMap((tenant) => {
          if (!tenant) {
            return of({ status: 'missing' } satisfies TenantDetailState);
          }

          return combineLatest([
            this.propertyService.getById(tenant.propertyId).pipe(catchError(() => of(undefined))),
            this.unitService.getById(tenant.unitId).pipe(catchError(() => of(undefined))),
            this.paymentService.getByTenantAtProperty(tenant.id, tenant.propertyId).pipe(
              catchError(() => of([] as Payment[]))
            ),
          ]).pipe(
            map(([property, unit, payments]) => ({
              status: 'ready',
              data: {
                tenant,
                payments,
                property,
                unit,
                rentStatus: getTenantRentStatus(tenant, payments),
                monthBalance: getTenantMonthBalance(tenant.monthlyRent, payments, {
                  tenantId: tenant.id,
                }),
                currency: property?.currency ?? defaultCurrency(this.auth.currentUser()?.countryCode),
                countryCode: property
                  ? propertyCountryCode(property)
                  : this.auth.currentUser()?.countryCode ?? 'GM',
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

  whatsAppLink(phone: string, countryCode?: string): string {
    const normalized = normalizePhone(phone, countryCode);
    return normalized ? `https://wa.me/${normalized}` : '#';
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
        { id: user.id, name: user.name?.trim() || 'Your landlord' },
        data.countryCode
      );
      this.notifications.success('Reminder saved in RentBook');
    } catch {
      this.notifications.show('Could not send reminder. Try again.');
    }
  }

  scrollToHistory(): void {
    document.getElementById('payment-history')?.scrollIntoView({ behavior: 'smooth' });
  }

  recordedByLabel(payment: Payment, data: TenantDetailData): string {
    return paymentRecordedByLabel(payment, {
      viewer: 'owner',
      ownerId: this.auth.currentUser()?.id,
      tenantUserId: data.tenant.userId,
    });
  }
}
