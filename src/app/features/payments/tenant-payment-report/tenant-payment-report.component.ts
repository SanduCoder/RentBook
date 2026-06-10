import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { PaymentService } from '../../../core/services/payment.service';
import { TenantService } from '../../../core/services/tenant.service';
import { PAYMENT_METHODS, PaymentMethod } from '../../../core/models/payment.model';
import { isTenancyLinked } from '../../../core/utils/role.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-tenant-payment-report',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  templateUrl: './tenant-payment-report.component.html',
  styleUrl: './tenant-payment-report.component.scss',
})
export class TenantPaymentReportComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private tenantService = inject(TenantService);
  private paymentService = inject(PaymentService);
  private notifications = inject(ErrorNotificationService);

  loading = signal(false);
  success = signal(false);
  referenceNumber = signal('');
  error = signal('');
  monthlyRent = signal(0);
  methods = PAYMENT_METHODS;

  form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    method: ['wave' as PaymentMethod, Validators.required],
    reference: ['', Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (!user || !isTenancyLinked(user)) {
      this.router.navigate(['/join']);
      return;
    }

    void this.loadTenantRent(user.tenantRecordId!);
  }

  private async loadTenantRent(tenantId: string): Promise<void> {
    const tenant = await firstValueFrom(this.tenantService.getById(tenantId));
    if (!tenant) return;
    this.monthlyRent.set(tenant.monthlyRent);
    if (!this.form.controls.amount.dirty) {
      this.form.patchValue({ amount: tenant.monthlyRent });
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
