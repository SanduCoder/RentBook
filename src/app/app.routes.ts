import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { tenantManagerGuard } from './core/guards/role.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'properties',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/properties/property-list/property-list.component').then(
            (m) => m.PropertyListComponent
          ),
      },
      {
        path: 'properties/new',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/properties/property-form/property-form.component').then(
            (m) => m.PropertyFormComponent
          ),
      },
      {
        path: 'properties/:id/edit',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/properties/property-form/property-form.component').then(
            (m) => m.PropertyFormComponent
          ),
      },
      {
        path: 'properties/:id',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/properties/property-detail/property-detail.component').then(
            (m) => m.PropertyDetailComponent
          ),
      },
      {
        path: 'tenants',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/tenants/tenant-list/tenant-list.component').then(
            (m) => m.TenantListComponent
          ),
      },
      {
        path: 'tenants/new',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/tenants/tenant-form/tenant-form.component').then(
            (m) => m.TenantFormComponent
          ),
      },
      {
        path: 'tenants/:id',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/tenants/tenant-detail/tenant-detail.component').then(
            (m) => m.TenantDetailComponent
          ),
      },
      {
        path: 'payments',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/payments/payment-list/payment-list.component').then(
            (m) => m.PaymentListComponent
          ),
      },
      {
        path: 'payments/new',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/payments/payment-form/payment-form.component').then(
            (m) => m.PaymentFormComponent
          ),
      },
      {
        path: 'payments/report',
        loadComponent: () =>
          import('./features/payments/tenant-payment-report/tenant-payment-report.component').then(
            (m) => m.TenantPaymentReportComponent
          ),
      },
      {
        path: 'my-payments',
        loadComponent: () =>
          import('./features/payments/my-payments/my-payments.component').then(
            (m) => m.MyPaymentsComponent
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/maintenance/maintenance-list/maintenance-list.component').then(
            (m) => m.MaintenanceListComponent
          ),
      },
      {
        path: 'requests/new',
        loadComponent: () =>
          import('./features/maintenance/maintenance-form/maintenance-form.component').then(
            (m) => m.MaintenanceFormComponent
          ),
      },
      {
        path: 'expenses',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/expenses/expense-list/expense-list.component').then(
            (m) => m.ExpenseListComponent
          ),
      },
      {
        path: 'expenses/new',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/expenses/expense-form/expense-form.component').then(
            (m) => m.ExpenseFormComponent
          ),
      },
      {
        path: 'shared-bills',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/shared-bills/shared-bill-list/shared-bill-list.component').then(
            (m) => m.SharedBillListComponent
          ),
      },
      {
        path: 'shared-bills/new',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/shared-bills/shared-bill-form/shared-bill-form.component').then(
            (m) => m.SharedBillFormComponent
          ),
      },
      {
        path: 'reports',
        canActivate: [tenantManagerGuard],
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'more',
        loadComponent: () =>
          import('./features/more/more.component').then((m) => m.MoreComponent),
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/account.component').then((m) => m.AccountComponent),
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./features/help/help-support.component').then((m) => m.HelpSupportComponent),
      },
      {
        path: 'join',
        loadComponent: () =>
          import('./features/auth/join/join.component').then((m) => m.JoinComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
