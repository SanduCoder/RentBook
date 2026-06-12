import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_COUNTRY_CODE,
  defaultCurrency,
  PaymentMethodOption,
} from '../../../core/config/country-profiles.config';
import { AuthService } from '../../../core/services/auth.service';
import { CountryProfileService } from '../../../core/services/country-profile.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { PaymentMethod } from '../../../core/models/payment.model';
import { propertyCountryCode } from '../../../core/utils/currency-aggregation.utils';
import { isTenancyLinked } from '../../../core/utils/role.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

@Component({
  selector: 'app-tenant-payment-report',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, CurrencyFormatPipe],
  templateUrl: './tenant-payment-report.component.html',
  styleUrl: './tenant-payment-report.component.scss',
})
export class TenantPaymentReportComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private tenantService = inject(TenantService);
  private propertyService = inject(PropertyService);
  private paymentService = inject(PaymentService);
  private notifications = inject(ErrorNotificationService);
  private countryProfiles = inject(CountryProfileService);

  loading = signal(false);
  success = signal(false);
  referenceNumber = signal('');
  error = signal('');
  monthlyRent = signal(0);
  currency = signal(defaultCurrency());
  methods = signal<PaymentMethodOption[]>(this.countryProfiles.paymentMethodsForUser());

  pageSubtitle = computed(
    () => `Tell your landlord you paid rent via ${this.countryProfiles.paymentMethodsLabel(this.tenantCountryCode())}`
  );
  referencePlaceholder = computed(() => {
    const mobileMethod = this.methods().find((method) =>
      ['wave', 'afrimoney', 'qmoney', 'mpesa', 'mtn_momo', 'orange_money', 'zelle', 'venmo', 'cash_app'].includes(
        method.value
      )
    );
    return mobileMethod ? `${mobileMethod.label} reference or transaction ID` : 'Transaction reference';
  });

  private tenantCountryCode = signal(DEFAULT_COUNTRY_CODE);

  form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    method: ['cash' as PaymentMethod, Validators.required],
    reference: ['', Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user || !isTenancyLinked(user)) {
      this.router.navigate(['/join']);
      return;
    }

    void this.loadTenantContext(user.tenantRecordId!, user.linkedPropertyId!);
  }

  private async loadTenantContext(tenantId: string, propertyId: string): Promise<void> {
    const [tenant, property] = await Promise.all([
      firstValueFrom(this.tenantService.getById(tenantId)),
      firstValueFrom(this.propertyService.getById(propertyId)),
    ]);
    if (!tenant) return;

    const countryCode = property ? propertyCountryCode(property) : this.auth.currentUser()?.countryCode;
    const resolvedCountry = countryCode ?? DEFAULT_COUNTRY_CODE;
    const currency = property?.currency ?? defaultCurrency(resolvedCountry);
    const nextMethods = this.countryProfiles.paymentMethodsForCountry(resolvedCountry);

    this.tenantCountryCode.set(resolvedCountry);
    this.currency.set(currency);
    this.methods.set(nextMethods);
    this.monthlyRent.set(tenant.monthlyRent);

    if (!this.form.controls.amount.dirty) {
      this.form.patchValue({
        amount: tenant.monthlyRent,
        method: nextMethods[0]?.value ?? 'cash',
      });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const user = this.auth.currentUser();
    if (!user?.tenantRecordId || !user.linkedPropertyId) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const tenant = await firstValueFrom(this.tenantService.getById(user.tenantRecordId));
      if (!tenant) {
        this.error.set('Could not load your tenancy details.');
        return;
      }

      const raw = this.form.getRawValue();
      const paymentId = await this.paymentService.reportPayment({
        tenantId: user.tenantRecordId,
        propertyId: user.linkedPropertyId,
        unitId: tenant.unitId,
        amount: raw.amount,
        date: new Date(raw.date),
        method: raw.method,
        reference: raw.reference.trim(),
        notes: raw.notes.trim() || undefined,
        recordedBy: user.id,
      });

      this.referenceNumber.set(this.paymentService.generateReceiptNumber(paymentId));
      this.success.set(true);
      this.notifications.success('Payment reported. Your landlord will verify it.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not report payment. Please try again.';
      this.error.set(message);
      this.notifications.handleError(err, message);
    } finally {
      this.loading.set(false);
    }
  }
}
