import { AsyncPipe, DecimalPipe, Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { navigateBack } from '../../../core/utils/navigate-back.util';
import { AuthService } from '../../../core/services/auth.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../../../core/models/expense.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss',
})
export class ExpenseFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private expenseService = inject(ExpenseService);
  private tenantService = inject(TenantService);

  loading = signal(false);
  categories = EXPENSE_CATEGORIES;

  preselectedPropertyId = this.route.snapshot.queryParamMap.get('propertyId') ?? '';

  properties$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '');

  form = this.fb.nonNullable.group({
    propertyId: [this.preselectedPropertyId, Validators.required],
    category: ['water' as ExpenseCategory, Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    description: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
    visibleToTenants: [false],
    sharedWithTenantId: ['all'],
  });

  propertyTenants$ = this.form.controls.propertyId.valueChanges.pipe(
    startWith(this.form.controls.propertyId.value),
    switchMap((propertyId) =>
      propertyId ? this.tenantService.getByProperty(propertyId) : of([])
    )
  );

  constructor() {
    this.form.controls.visibleToTenants.valueChanges.subscribe((shared) => {
      const description = this.form.controls.description;
      description.setValidators(shared ? [Validators.required] : []);
      description.updateValueAndValidity({ emitEvent: false });
    });

    this.form.controls.propertyId.valueChanges.subscribe(() => {
      this.form.controls.sharedWithTenantId.setValue('all');
    });
  }

  countActive(tenants: { active?: boolean }[]): number {
    return tenants.filter((tenant) => tenant.active !== false).length;
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    navigateBack(this.location, this.router, ['/expenses']);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const user = this.auth.currentUser();
    if (!user) return;

    this.loading.set(true);
    try {
      const raw = this.form.getRawValue();
      const splitTenantIds =
        raw.visibleToTenants && raw.sharedWithTenantId === 'all'
          ? (await firstValueFrom(this.tenantService.getByProperty(raw.propertyId)))
              .filter((tenant) => tenant.active !== false)
              .map((tenant) => tenant.id)
          : undefined;

      await this.expenseService.create({
        ...raw,
        date: new Date(raw.date),
        createdBy: user.id,
        splitTenantIds,
      });
      if (this.preselectedPropertyId) {
        this.router.navigate(['/properties', this.preselectedPropertyId], {
          queryParams: { tab: 'expenses' },
        });
      } else {
        this.router.navigate(['/expenses']);
      }
    } finally {
      this.loading.set(false);
    }
  }
}
