import { AsyncPipe, Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { navigateBack } from '../../../core/utils/navigate-back.util';
import { AuthService } from '../../../core/services/auth.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { PropertyService } from '../../../core/services/property.service';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../../../core/models/expense.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule, PageHeaderComponent],
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
  });

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
      await this.expenseService.create({
        ...raw,
        date: new Date(raw.date),
        createdBy: user.id,
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
