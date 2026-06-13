import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UnitService } from '../../../core/services/unit.service';
import {
  MAINTENANCE_CATEGORIES,
  MaintenanceCategory,
} from '../../../core/models/maintenance.model';
import { isTenancyLinked, isTenant } from '../../../core/utils/role.utils';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

interface TenantRequestContext {
  propertyName: string;
  unitName: string;
}

@Component({
  selector: 'app-maintenance-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  templateUrl: './maintenance-form.component.html',
  styleUrl: './maintenance-form.component.scss',
})
export class MaintenanceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private tenantService = inject(TenantService);
  private unitService = inject(UnitService);
  private maintenanceService = inject(MaintenanceService);
  private notifications = inject(ErrorNotificationService);

  loading = signal(false);
  error = signal('');
  categories = MAINTENANCE_CATEGORIES;
  isTenantUser = signal(false);
  tenantContext = signal<TenantRequestContext | null>(null);

  properties$ = toObservable(this.auth.currentUser).pipe(
    switchMap((user) => {
      if (!user || isTenant(user.role)) return of([]);
      return this.propertyService.getByOwner(user.id);
    })
  );

  tenants$ = this.properties$.pipe(
    switchMap((properties) => {
      if (properties.length === 0) return of([]);
      const tenantObs = properties.map((p) => this.tenantService.getByProperty(p.id));
      return combineLatest(tenantObs).pipe(map((groups) => groups.flat()));
    })
  );

  form = this.fb.nonNullable.group({
    propertyId: ['', Validators.required],
    tenantId: [''],
    category: ['water' as MaintenanceCategory, Validators.required],
    title: ['', Validators.required],
    description: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    await this.auth.waitForSession();
    const user = this.auth.currentUser();
    if (!user) return;

    if (!isTenant(user.role)) return;

    this.isTenantUser.set(true);

    if (!isTenancyLinked(user) || !user.linkedPropertyId || !user.tenantRecordId) {
      this.router.navigate(['/join']);
      return;
    }

    this.form.patchValue({
      propertyId: user.linkedPropertyId,
      tenantId: user.tenantRecordId,
    });

    await this.loadTenantContext(user.linkedPropertyId, user.tenantRecordId);
  }

  private async loadTenantContext(propertyId: string, tenantId: string): Promise<void> {
    const tenant = await firstValueFrom(this.tenantService.getById(tenantId));
    if (!tenant) return;

    const [property, unit] = await Promise.all([
      firstValueFrom(this.propertyService.getById(propertyId)),
      firstValueFrom(this.unitService.getById(tenant.unitId)),
    ]);

    this.tenantContext.set({
      propertyName: property?.name ?? 'Property',
      unitName: unit?.name ?? 'Unit',
    });
  }

  onCategoryChange(category: MaintenanceCategory): void {
    const label = this.categories.find((c) => c.value === category)?.label ?? '';
    if (!this.form.controls.title.dirty) {
      this.form.patchValue({ title: label });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');
    try {
      const raw = this.form.getRawValue();
      let tenantName: string | undefined;

      if (raw.tenantId) {
        const tenant = await firstValueFrom(this.tenantService.getById(raw.tenantId));
        tenantName = tenant?.name;
      } else if (this.isTenantUser()) {
        tenantName = this.auth.currentUser()?.name;
      }

      const user = this.auth.currentUser();
      if (!user) return;

      await this.maintenanceService.create({
        propertyId: raw.propertyId,
        tenantId: raw.tenantId,
        tenantName,
        title: raw.title.trim(),
        description: raw.description.trim(),
        category: raw.category,
        reportedBy: user.id,
        reportedByTenant: this.isTenantUser(),
      });
      this.notifications.success('Maintenance request submitted.');
      this.router.navigate(['/requests']);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not submit request. Please try again.';
      this.error.set(message);
      this.notifications.handleError(err, message);
    } finally {
      this.loading.set(false);
    }
  }
}
