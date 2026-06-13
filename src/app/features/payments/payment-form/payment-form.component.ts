import { AsyncPipe, DatePipe, Location } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { navigateBack } from '../../../core/utils/navigate-back.util';
import { combineLatest, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { defaultCurrency, PaymentMethodOption } from '../../../core/config/country-profiles.config';
import { AuthService } from '../../../core/services/auth.service';
import { CountryProfileService } from '../../../core/services/country-profile.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { PaymentMethod, PaymentStatus, Payment, PAYMENT_STATUS_LABELS, paymentRecordedAt, paymentRecordedByLabel } from '../../../core/models/payment.model';
import { getTenantMonthBalance } from '../../../core/utils/payment-stats.utils';
import {
  showListCollapse,
  showListExpand,
  visibleListItems,
} from '../../../core/utils/list-preview.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { propertyCountryCode } from '../../../core/utils/currency-aggregation.utils';

interface PaymentTenantOption {
  id: string;
  name: string;
  monthlyRent: number;
  propertyId: string;
  currency: string;
  countryCode: string;
}

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, PageHeaderComponent, CurrencyFormatPipe],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss',
})
export class PaymentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private tenantService = inject(TenantService);
  private paymentService = inject(PaymentService);
  private countryProfiles = inject(CountryProfileService);

  loading = signal(false);
  success = signal(false);
  receiptNumber = signal('');
  monthlyRent = signal(0);
  paidThisMonth = signal(0);
  balanceRemaining = signal(0);
  currency = signal(defaultCurrency());
  recentPayments = signal<Payment[]>([]);
  recentPaymentsExpanded = signal(false);
  visibleRecentPayments = visibleListItems;
  showRecentPaymentsExpand = showListExpand;
  showRecentPaymentsCollapse = showListCollapse;
  statusLabels = PAYMENT_STATUS_LABELS;
  methods = signal<PaymentMethodOption[]>(this.countryProfiles.paymentMethodsForUser());

  referencePlaceholder = computed(() => {
    const mobileMethod = this.methods().find((method) =>
      ['wave', 'afrimoney', 'qmoney', 'mpesa', 'mtn_momo', 'orange_money', 'zelle', 'venmo', 'cash_app'].includes(
        method.value
      )
    );
    return mobileMethod
      ? `${mobileMethod.label} reference or transaction ID (optional)`
      : 'Transaction reference (optional)';
  });

  preselectedTenantId = this.route.snapshot.queryParamMap.get('tenantId') ?? '';
  preselectedPropertyId = this.route.snapshot.queryParamMap.get('propertyId') ?? '';

  properties$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '');

  tenants$ = this.preselectedPropertyId
    ? this.tenantService.getByProperty(this.preselectedPropertyId)
    : this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '').pipe(
        switchMap((properties) => {
          if (properties.length === 0) return of([]);
          const tenantObs = properties.map((p) => this.tenantService.getByProperty(p.id));
          return combineLatest(tenantObs).pipe(map((groups) => groups.flat()));
        })
      );

  tenantOptions$ = combineLatest([this.tenants$, this.properties$]).pipe(
    map(([tenants, properties]) => {
      const propertyById = new Map(properties.map((property) => [property.id, property]));
      const user = this.auth.currentUser();
      const fallbackCurrency = defaultCurrency(user?.countryCode);
      const fallbackCountry = user?.countryCode ?? 'GM';

      return tenants.map((tenant) => {
        const property = propertyById.get(tenant.propertyId);
        return {
          id: tenant.id,
          name: tenant.name,
          monthlyRent: tenant.monthlyRent,
          propertyId: tenant.propertyId,
          currency: property?.currency ?? fallbackCurrency,
          countryCode: property ? propertyCountryCode(property) : fallbackCountry,
        } satisfies PaymentTenantOption;
      });
    })
  );

  form = this.fb.nonNullable.group({
    tenantId: [this.preselectedTenantId, Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    method: ['cash' as PaymentMethod, Validators.required],
    reference: [''],
    notes: [''],
    status: ['paid' as PaymentStatus, Validators.required],
  });

  ngOnInit(): void {
    this.form.controls.tenantId.valueChanges
      .pipe(startWith(this.form.controls.tenantId.value))
      .subscribe((tenantId) => {
        void this.loadTenantContext(tenantId);
      });
  }

  onTenantChange(tenantId: string): void {
    void this.loadTenantContext(tenantId);
  }

  private async loadTenantContext(tenantId: string): Promise<void> {
    if (!tenantId) {
      this.monthlyRent.set(0);
      this.paidThisMonth.set(0);
      this.balanceRemaining.set(0);
      this.recentPayments.set([]);
      this.recentPaymentsExpanded.set(false);
      this.methods.set(this.countryProfiles.paymentMethodsForUser());
      return;
    }

    this.recentPaymentsExpanded.set(false);

    const tenant = await firstValueFrom(this.tenantService.getById(tenantId));
    if (!tenant) return;

    const [property, payments] = await Promise.all([
      firstValueFrom(this.propertyService.getById(tenant.propertyId)),
      firstValueFrom(this.paymentService.getByTenantAtProperty(tenant.id, tenant.propertyId)),
    ]);

    const countryCode = property ? propertyCountryCode(property) : this.auth.currentUser()?.countryCode;
    const nextMethods = this.countryProfiles.paymentMethodsForCountry(countryCode);
    const monthBalance = getTenantMonthBalance(tenant.monthlyRent, payments, { tenantId: tenant.id });

    this.methods.set(nextMethods);
    this.currency.set(property?.currency ?? defaultCurrency(countryCode));
    this.monthlyRent.set(tenant.monthlyRent);
    this.paidThisMonth.set(monthBalance.paidThisMonth);
    this.balanceRemaining.set(monthBalance.balanceRemaining);
    this.recentPayments.set(
      [...payments].sort((a, b) => paymentRecordedAt(b).getTime() - paymentRecordedAt(a).getTime())
    );

    const currentMethod = this.form.controls.method.value;
    if (!nextMethods.some((method) => method.value === currentMethod)) {
      this.form.patchValue({ method: nextMethods[0]?.value ?? 'cash' });
    }

    if (!this.form.controls.amount.dirty) {
      const suggestedAmount =
        monthBalance.balanceRemaining > 0 ? monthBalance.balanceRemaining : tenant.monthlyRent;
      this.form.patchValue({ amount: suggestedAmount });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const user = this.auth.currentUser();
    if (!user) return;

    this.loading.set(true);
    try {
      const raw = this.form.getRawValue();
      const tenant = await firstValueFrom(this.tenantService.getById(raw.tenantId));
      if (!tenant) return;

      const paymentId = await this.paymentService.create({
        tenantId: raw.tenantId,
        propertyId: tenant.propertyId,
        unitId: tenant.unitId,
        amount: raw.amount,
        date: new Date(raw.date),
        method: raw.method,
        reference: raw.reference || undefined,
        notes: raw.notes || undefined,
        status: raw.status,
        recordedBy: user.id,
      });

      this.receiptNumber.set(this.paymentService.generateReceiptNumber(paymentId));
      this.success.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    navigateBack(this.location, this.router, ['/payments']);
  }

  done(): void {
    if (this.preselectedPropertyId) {
      this.router.navigate(['/properties', this.preselectedPropertyId], {
        queryParams: { tab: 'overview' },
      });
      return;
    }
    this.router.navigate(['/payments']);
  }

  recordedByLabel(payment: Payment): string {
    const user = this.auth.currentUser();
    return paymentRecordedByLabel(payment, user ? { viewer: 'owner', ownerId: user.id } : undefined);
  }

  recordedAt = paymentRecordedAt;
}
