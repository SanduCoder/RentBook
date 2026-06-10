import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Property } from '../../../core/models/property.model';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { Unit } from '../../../core/models/unit.model';
import { UnitService } from '../../../core/services/unit.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-tenant-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  templateUrl: './tenant-form.component.html',
  styleUrl: './tenant-form.component.scss',
})
export class TenantFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private unitService = inject(UnitService);
  private tenantService = inject(TenantService);

  loading = signal(false);

  propertyId = this.route.snapshot.queryParamMap.get('propertyId') ?? '';

  properties$: Observable<Property[]> = this.auth.currentUser()
    ? this.propertyService.getByOwner(this.auth.currentUser()!.id)
    : of([]);

  units$: Observable<Unit[]> | null = this.propertyId
    ? this.unitService.getByProperty(this.propertyId)
    : null;

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

  onPropertyChange(propertyId: string): void {
    this.form.patchValue({ propertyId, unitId: '' });
    this.units$ = this.unitService.getByProperty(propertyId);
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
