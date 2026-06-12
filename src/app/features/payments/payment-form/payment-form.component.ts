import { AsyncPipe, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
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
import { PaymentMethod, PaymentStatus } from '../../../core/models/payment.model';
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
  imports: [AsyncPipe, ReactiveFormsModule, PageHeaderComponent, CurrencyFormatPipe],
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
  methods = signal<PaymentMethodOption[]>(this.countryProfiles.paymentMethodsForUser());

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
        void this.refreshMethodsForTenant(tenantId);
      });
  }

  onTenantChange(tenantId: string): void {
    void this.refreshMethodsForTenant(tenantId);
  }

  private async refreshMethodsForTenant(tenantId: string): Promise<void> {
    if (!tenantId) {
      this.methods.set(this.countryProfiles.paymentMethodsForUser());
      return;
    }

    const tenant = await firstValueFrom(this.tenantService.getById(tenantId));
    if (!tenant) return;

    const property = await firstValueFrom(this.propertyService.getById(tenant.propertyId));
    const countryCode = property ? propertyCountryCode(property) : this.auth.currentUser()?.countryCode;
    const nextMethods = this.countryProfiles.paymentMethodsForCountry(countryCode);
    this.methods.set(nextMethods);

    const currentMethod = this.form.controls.method.value;
    if (!nextMethods.some((method) => method.value === currentMethod)) {
      this.form.patchValue({ method: nextMethods[0]?.value ?? 'cash' });
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
}
