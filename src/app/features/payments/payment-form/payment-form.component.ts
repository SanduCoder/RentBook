import { AsyncPipe, Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { navigateBack } from '../../../core/utils/navigate-back.util';
import { combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { PAYMENT_METHODS, PaymentMethod, PaymentStatus } from '../../../core/models/payment.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss',
})
export class PaymentFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private tenantService = inject(TenantService);
  private paymentService = inject(PaymentService);

  loading = signal(false);
  success = signal(false);
  receiptNumber = signal('');

  methods = PAYMENT_METHODS;

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

  form = this.fb.nonNullable.group({
    tenantId: [this.preselectedTenantId, Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    method: ['wave' as PaymentMethod, Validators.required],
    reference: [''],
    notes: [''],
    status: ['paid' as PaymentStatus, Validators.required],
  });

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
