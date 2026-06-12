import { AsyncPipe, Location } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { navigateBack } from '../../../core/utils/navigate-back.util';
import { defaultCurrency } from '../../../core/config/country-profiles.config';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyService } from '../../../core/services/property.service';
import { SharedBillService } from '../../../core/services/shared-bill.service';
import {
  SHARED_BILL_TYPES,
  SharedBillType,
  calculatePerHousehold,
} from '../../../core/models/shared-bill.model';
import { firstValueFrom } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

@Component({
  selector: 'app-shared-bill-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, PageHeaderComponent, CurrencyFormatPipe],
  templateUrl: './shared-bill-form.component.html',
  styleUrl: './shared-bill-form.component.scss',
})
export class SharedBillFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private sharedBillService = inject(SharedBillService);

  loading = signal(false);
  billTypes = SHARED_BILL_TYPES;
  currency = signal(defaultCurrency(this.auth.currentUser()?.countryCode));

  preselectedPropertyId = this.route.snapshot.queryParamMap.get('propertyId') ?? '';

  properties$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '');

  form = this.fb.nonNullable.group({
    propertyId: [this.preselectedPropertyId, Validators.required],
    type: ['water' as SharedBillType, Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    households: [1, [Validators.required, Validators.min(1)]],
    description: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
  });

  ngOnInit(): void {
    this.form.controls.propertyId.valueChanges.subscribe((propertyId) => {
      void this.updateCurrencyForProperty(propertyId);
    });
    if (this.preselectedPropertyId) {
      void this.updateCurrencyForProperty(this.preselectedPropertyId);
    }
  }

  private async updateCurrencyForProperty(propertyId: string): Promise<void> {
    if (!propertyId) {
      this.currency.set(defaultCurrency(this.auth.currentUser()?.countryCode));
      return;
    }

    const property = await firstValueFrom(this.propertyService.getById(propertyId));
    this.currency.set(property?.currency ?? defaultCurrency(this.auth.currentUser()?.countryCode));
  }

  calcPerHousehold(): number {
    return calculatePerHousehold(
      this.form.controls.amount.value,
      this.form.controls.households.value
    );
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    navigateBack(this.location, this.router, ['/shared-bills']);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const user = this.auth.currentUser();
    if (!user) return;

    this.loading.set(true);
    try {
      const raw = this.form.getRawValue();
      await this.sharedBillService.create({
        propertyId: raw.propertyId,
        type: raw.type,
        amount: raw.amount,
        households: raw.households,
        splitMethod: 'equal',
        description: raw.description.trim() || undefined,
        date: new Date(raw.date),
        createdBy: user.id,
      });
      if (this.preselectedPropertyId) {
        this.router.navigate(['/properties', this.preselectedPropertyId], {
          queryParams: { tab: 'bills' },
        });
      } else {
        this.router.navigate(['/shared-bills']);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
