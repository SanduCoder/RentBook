import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Property } from '../../../core/models/property.model';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { Unit } from '../../../core/models/unit.model';
import { UnitService } from '../../../core/services/unit.service';
import { defaultCurrency } from '../../../core/config/country-profiles.config';
import { phonePlaceholder as formatPhonePlaceholder } from '../../../core/utils/country-detect.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

@Component({
  selector: 'app-tenant-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, PageHeaderComponent, CurrencyFormatPipe],
  templateUrl: './tenant-form.component.html',
  styleUrl: './tenant-form.component.scss',
})
export class TenantFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private unitService = inject(UnitService);
  private tenantService = inject(TenantService);
  loading = signal(false);
  vacantUnits = signal<Unit[]>([]);
  propertyCurrency = signal(defaultCurrency(this.auth.currentUser()?.countryCode));

  phonePlaceholderText(): string {
    return formatPhonePlaceholder(this.auth.currentUser()?.countryCode);
  }

  propertyId = this.route.snapshot.queryParamMap.get('propertyId') ?? '';

  properties$: Observable<Property[]> = this.auth.currentUser()
    ? this.propertyService.getByOwner(this.auth.currentUser()!.id)
    : of([]);

  form = this.fb.nonNullable.group({
    propertyId: [this.propertyId, Validators.required],
    unitId: ['', Validators.required],
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
    occupation: [''],
    moveInDate: [new Date().toISOString().split('T')[0], Validators.required],
    monthlyRent: [0, [Validators.required, Validators.min(0)]],
    dueDay: [1, [Validators.required, Validators.min(1), Validators.max(28)]],
  });

  ngOnInit(): void {
    if (this.propertyId) {
      void this.loadVacantUnits(this.propertyId);
      void this.updatePropertyCurrency(this.propertyId);
    }
  }

  onPropertyChange(propertyId: string): void {
    this.form.patchValue({ propertyId, unitId: '', monthlyRent: 0 });
    void this.loadVacantUnits(propertyId);
    void this.updatePropertyCurrency(propertyId);
  }

  private async updatePropertyCurrency(propertyId: string): Promise<void> {
    if (!propertyId) {
      this.propertyCurrency.set(defaultCurrency(this.auth.currentUser()?.countryCode));
      return;
    }

    const property = await firstValueFrom(this.propertyService.getById(propertyId));
    this.propertyCurrency.set(property?.currency ?? defaultCurrency(this.auth.currentUser()?.countryCode));
  }

  onUnitChange(unitId: string): void {
    const unit = this.vacantUnits().find((item) => item.id === unitId);
    if (unit) {
      this.form.patchValue({ monthlyRent: unit.monthlyRent });
    }
  }

  private async loadVacantUnits(propertyId: string): Promise<void> {
    if (!propertyId) {
      this.vacantUnits.set([]);
      return;
    }

    const units = await firstValueFrom(this.unitService.getByProperty(propertyId));
    this.vacantUnits.set(units.filter((unit) => unit.status === 'vacant'));
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    try {
      const raw = this.form.getRawValue();
      const id = await this.tenantService.create({
        ...raw,
        moveInDate: new Date(raw.moveInDate),
      });
      await this.unitService.update(raw.unitId, { status: 'occupied' });
      if (this.propertyId) {
        this.router.navigate(['/properties', this.propertyId], {
          queryParams: { tab: 'tenants' },
        });
      } else {
        this.router.navigate(['/tenants', id]);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
