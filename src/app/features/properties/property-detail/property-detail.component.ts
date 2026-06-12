import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  Expense,
  ExpenseCategory,
} from '../../../core/models/expense.model';
import { Payment } from '../../../core/models/payment.model';
import {
  SHARED_BILL_TYPE_LABELS,
  SHARED_BILL_TYPES,
  SharedBill,
  SharedBillType,
  calculatePerHousehold,
} from '../../../core/models/shared-bill.model';
import { Tenant } from '../../../core/models/tenant.model';
import { UNIT_TYPES, Unit, UnitType, formatUnitLayout } from '../../../core/models/unit.model';
import { PROPERTY_TYPE_LABELS, Property, PropertyType } from '../../../core/models/property.model';
import { AuthService } from '../../../core/services/auth.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { InviteCodeService } from '../../../core/services/invite-code.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { SharedBillService } from '../../../core/services/shared-bill.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UnitService } from '../../../core/services/unit.service';
import { getMonthStart } from '../../../core/utils/firestore.utils';
import {
  calculateExpectedMonthlyRent,
  calculateMonthlyDiscount,
  calculateOutstandingRent,
  calculateVacantRentLoss,
  sumRentCredits,
} from '../../../core/utils/payment-stats.utils';
import { PAYMENT_METHOD_LABELS } from '../../../core/models/payment.model';
import { PropertyActivity, propertyActivityLink } from '../../../core/utils/activity.utils';
import { RentReminderService } from '../../../core/services/rent-reminder.service';
import {
  PropertyRentDueSummary,
  RentDueTenant,
  TenantRentStatusInfo,
  getPropertyRentDueSummary,
  getTenantRentStatus,
} from '../../../core/utils/tenant-status.utils';

interface PropertyTenantItem {
  tenant: Tenant;
  unitName: string;
  rentStatus: TenantRentStatusInfo;
}
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { InviteCodeDisplayComponent } from '../../../shared/components/invite-code-display/invite-code-display.component';

type PropertyTab = 'overview' | 'units' | 'tenants' | 'expenses' | 'bills';

interface PropertyOverview {
  collectedThisMonth: number;
  expectedMonthlyRent: number;
  outstandingRent: number;
  occupiedUnits: number;
  vacantUnits: number;
  vacantRentLoss: number;
  totalUnits: number;
  occupancyRate: number;
  openMaintenance: number;
  currency: string;
  monthlyDiscount: number;
  listedRent: number;
  quotedRent: number;
  discountedTenants: number;
  rentDue: PropertyRentDueSummary;
}

@Component({
  selector: 'app-property-detail',
  standalone: true,
  imports: [AsyncPipe, DatePipe, ReactiveFormsModule, RouterLink, CurrencyFormatPipe, InviteCodeDisplayComponent],
  templateUrl: './property-detail.component.html',
  styleUrl: './property-detail.component.scss',
})
export class PropertyDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private propertyService = inject(PropertyService);
  private unitService = inject(UnitService);
  private tenantService = inject(TenantService);
  private paymentService = inject(PaymentService);
  private maintenanceService = inject(MaintenanceService);
  private expenseService = inject(ExpenseService);
  private sharedBillService = inject(SharedBillService);
  private auth = inject(AuthService);
  private inviteCodeService = inject(InviteCodeService);
  private notifications = inject(ErrorNotificationService);
  private rentReminders = inject(RentReminderService);

  regeneratingPropertyCode = signal(false);
  propertyInviteCode = signal('');

  activeTab = signal<PropertyTab>('overview');
  showPropertyMenu = signal(false);
  showUnitForm = signal(false);
  savingUnit = signal(false);
  editingUnitId = signal<string | null>(null);
  editingTenantId = signal<string | null>(null);
  editingTenantUnitId = signal<string | null>(null);
  editingExpenseId = signal<string | null>(null);
  editingBillId = signal<string | null>(null);
  savingTenant = signal(false);
  savingExpense = signal(false);
  savingBill = signal(false);

  propertyTypeLabels = PROPERTY_TYPE_LABELS;

  expenseLabels = EXPENSE_CATEGORY_LABELS;
  expenseCategories = EXPENSE_CATEGORIES;
  billLabels = SHARED_BILL_TYPE_LABELS;
  billTypes = SHARED_BILL_TYPES;
  unitTypes = UNIT_TYPES;
  perHousehold = calculatePerHousehold;
  formatUnitLayout = formatUnitLayout;

  tabs: { id: PropertyTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'units', label: 'Units' },
    { id: 'tenants', label: 'Tenants' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'bills', label: 'Bills' },
  ];

  propertyId$ = this.route.paramMap.pipe(map((p) => p.get('id')!));

  property$ = this.propertyId$.pipe(
    switchMap((id) => this.propertyService.getById(id))
  );

  overview$ = this.propertyId$.pipe(
    switchMap((id) =>
      combineLatest([
        this.propertyService.getById(id),
        this.unitService.getByProperty(id),
        this.tenantService.getByProperty(id),
        this.paymentService.getByProperty(id),
        this.maintenanceService.getByProperty(id),
      ]).pipe(
        map(([property, units, tenants, payments, requests]) => {
          const monthStart = getMonthStart();
          const collectedThisMonth = sumRentCredits(payments, { monthStart });

          const occupiedUnits = units.filter((u) => u.status === 'occupied').length;
          const vacantUnits = units.filter((u) => u.status === 'vacant').length;
          const totalUnits = units.length;
          const discount = calculateMonthlyDiscount(units, tenants);
          const unitNames = new Map(units.map((u) => [u.id, u.name]));

          return {
            collectedThisMonth,
            expectedMonthlyRent: calculateExpectedMonthlyRent(units, tenants),
            outstandingRent: calculateOutstandingRent(tenants, payments),
            occupiedUnits,
            vacantUnits,
            vacantRentLoss: calculateVacantRentLoss(units),
            totalUnits,
            occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
            openMaintenance: requests.filter((r) => r.status !== 'completed').length,
            currency: property?.currency ?? 'GMD',
            monthlyDiscount: discount.totalDiscount,
            listedRent: discount.listedRent,
            quotedRent: discount.quotedRent,
            discountedTenants: discount.discountedTenants,
            rentDue: getPropertyRentDueSummary(tenants, unitNames, payments),
          } satisfies PropertyOverview;
        }),
        catchError(() =>
          of({
            collectedThisMonth: 0,
            expectedMonthlyRent: 0,
            outstandingRent: 0,
            occupiedUnits: 0,
            vacantUnits: 0,
            vacantRentLoss: 0,
            totalUnits: 0,
            occupancyRate: 0,
            openMaintenance: 0,
            currency: 'GMD',
            monthlyDiscount: 0,
            listedRent: 0,
            quotedRent: 0,
            discountedTenants: 0,
            rentDue: { nearest: null, dueThisWeekCount: 0 },
          })
        )
      )
    )
  );

  activity$ = this.propertyId$.pipe(
    switchMap((id) =>
      combineLatest([
        this.paymentService.getByProperty(id),
        this.tenantService.getByProperty(id),
      ]).pipe(
        map(([payments, tenants]) => {
          const tenantNames = new Map(tenants.map((t) => [t.id, t.name]));
          return payments.slice(0, 6).map((p) => {
            const name = tenantNames.get(p.tenantId);
            const amount = `D${p.amount.toLocaleString()}`;
            const method = PAYMENT_METHOD_LABELS[p.method];
            let message: string;

            if (p.status === 'pending_verification' || (p.reportedByTenant && p.status !== 'paid' && p.status !== 'partial')) {
              message = name
                ? `${name} reported ${amount} via ${method} (pending)`
                : `Payment reported — ${amount} (pending)`;
            } else {
              message = name ? `${name} paid ${amount}` : `Payment recorded — ${amount}`;
            }

            return {
              id: p.id,
              type: 'payment' as const,
              tenantId: p.tenantId,
              message,
              timestamp: p.date,
              amount: p.amount,
            };
          });
        }),
        catchError(() => of([] as PropertyActivity[]))
      )
    )
  );

  units$ = this.propertyId$.pipe(
    switchMap((id) => this.unitService.getByProperty(id))
  );

  tenants$ = this.propertyId$.pipe(
    switchMap((id) => this.tenantService.getByProperty(id))
  );

  tenantItems$ = this.propertyId$.pipe(
    switchMap((id) =>
      combineLatest([
        this.tenantService.getByProperty(id),
        this.unitService.getByProperty(id),
        this.paymentService.getByProperty(id),
      ]).pipe(
        map(([tenants, units, payments]) => {
          const unitMap = new Map(units.map((u) => [u.id, u]));

          return tenants.map((tenant) => ({
            tenant,
            unitName: unitMap.get(tenant.unitId)?.name ?? 'Unit',
            rentStatus: getTenantRentStatus(
              tenant,
              payments.filter((p) => p.tenantId === tenant.id)
            ),
          } satisfies PropertyTenantItem));
        })
      )
    )
  );

  expenses$ = this.propertyId$.pipe(
    switchMap((id) => this.expenseService.getByProperty(id))
  );

  sharedBills$ = this.propertyId$.pipe(
    switchMap((id) => this.sharedBillService.getByProperty(id))
  );

  unitForm = this.fb.group({
    name: ['', Validators.required],
    type: ['room' as UnitType, Validators.required],
    rooms: [1, [Validators.required, Validators.min(1)]],
    bathrooms: [1, [Validators.required, Validators.min(1)]],
    monthlyRent: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  tenantForm = this.fb.nonNullable.group({
    unitId: ['', Validators.required],
    name: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
    moveInDate: [new Date().toISOString().split('T')[0], Validators.required],
    monthlyRent: [0, [Validators.required, Validators.min(0)]],
    dueDay: [1, [Validators.required, Validators.min(1), Validators.max(28)]],
  });

  expenseForm = this.fb.nonNullable.group({
    category: ['water' as ExpenseCategory, Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    description: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
  });

  billForm = this.fb.nonNullable.group({
    type: ['water' as SharedBillType, Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    households: [1, [Validators.required, Validators.min(1)]],
    description: [''],
    date: [new Date().toISOString().split('T')[0], Validators.required],
  });

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as PropertyTab | null;
    if (tab && this.tabs.some((t) => t.id === tab)) {
      this.activeTab.set(tab);
    }

    this.property$.subscribe((property) => {
      if (property) {
        void this.ensurePropertyInviteCode(property);
      }
    });
  }

  async ensurePropertyInviteCode(property: Property): Promise<void> {
    if (property.inviteCode) {
      this.propertyInviteCode.set(property.inviteCode);
      return;
    }

    const user = this.auth.currentUser();
    if (!user) return;

    try {
      const code = await this.inviteCodeService.ensurePropertyCode(
        user.id,
        user.name,
        property.id,
        property.name
      );
      this.propertyInviteCode.set(code);
    } catch (err) {
      console.error('Failed to load property invite code', err);
    }
  }

  async regeneratePropertyInviteCode(property: Property): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    this.regeneratingPropertyCode.set(true);
    try {
      const code = await this.inviteCodeService.regeneratePropertyCode(
        user.id,
        user.name,
        property.id,
        property.name
      );
      this.propertyInviteCode.set(code);
    } catch (err) {
      console.error('Failed to regenerate property invite code', err);
      window.alert('Could not create a new code. Please try again.');
    } finally {
      this.regeneratingPropertyCode.set(false);
    }
  }

  @HostListener('document:click')
  closePropertyMenu(): void {
    this.showPropertyMenu.set(false);
  }

  togglePropertyMenu(event: Event): void {
    event.stopPropagation();
    this.showPropertyMenu.update((open) => !open);
  }

  async deleteProperty(property: Property): Promise<void> {
    this.showPropertyMenu.set(false);

    const units = await firstValueFrom(this.units$);

    if (units.length > 0) {
      window.alert(
        `Cannot delete "${property.name}" while it has ${units.length} unit(s). Remove all units first.`
      );
      return;
    }

    if (!window.confirm(`Delete "${property.name}"? This cannot be undone.`)) return;

    await this.propertyService.delete(property.id);
    this.router.navigate(['/properties']);
  }

  setTab(tab: PropertyTab): void {
    this.activeTab.set(tab);
  }

  async sendRentReminder(due: RentDueTenant, currency: string): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    try {
      await this.rentReminders.sendFromDue(due, currency, {
        id: user.id,
        name: user.name?.trim() || 'Your landlord',
      });
      this.notifications.success('Reminder saved in RentBook');
    } catch {
      this.notifications.show('Could not send reminder. Try again.');
    }
  }

  locationLabel(address: string): string {
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : address;
  }

  typeLabel(type: PropertyType): string {
    return PROPERTY_TYPE_LABELS[type];
  }

  unitWord(type: PropertyType, count: number): string {
    const map: Record<PropertyType, [string, string]> = {
      compound: ['room', 'rooms'],
      apartment: ['unit', 'units'],
      room: ['room', 'rooms'],
      shop: ['shop', 'shops'],
      office: ['office', 'offices'],
    };
    const [singular, plural] = map[type];
    return count === 1 ? singular : plural;
  }

  activityLink = propertyActivityLink;

  tenantUnitOptions(units: Unit[], tenant?: Tenant): Unit[] {
    if (!tenant) return units.filter((u) => u.status === 'vacant');
    return units.filter((u) => u.status === 'vacant' || u.id === tenant.unitId);
  }

  onTenantUnitChange(unitId: string, units: Unit[]): void {
    const unit = units.find((item) => item.id === unitId);
    if (unit) {
      this.tenantForm.patchValue({ monthlyRent: unit.monthlyRent });
    }
  }

  editingTenantFrom(tenants: Tenant[]): Tenant | undefined {
    const id = this.editingTenantId();
    return id ? tenants.find((t) => t.id === id) : undefined;
  }

  toggleUnitForm(): void {
    if (this.showUnitForm()) {
      this.cancelUnitForm();
    } else {
      this.showUnitForm.set(true);
    }
  }

  startEditUnit(unit: Unit): void {
    this.editingUnitId.set(unit.id);
    this.showUnitForm.set(true);
    this.unitForm.patchValue({
      name: unit.name,
      type: unit.type as UnitType,
      rooms: unit.rooms ?? 1,
      bathrooms: unit.bathrooms ?? 1,
      monthlyRent: unit.monthlyRent,
    });
  }

  cancelUnitForm(): void {
    this.editingUnitId.set(null);
    this.showUnitForm.set(false);
    this.unitForm.reset({
      name: '',
      type: 'room',
      rooms: 1,
      bathrooms: 1,
      monthlyRent: null,
    });
  }

  async saveUnit(propertyId: string): Promise<void> {
    if (this.unitForm.invalid) return;

    this.savingUnit.set(true);
    try {
      const raw = this.unitForm.getRawValue();
      const payload = {
        name: raw.name!,
        type: raw.type!,
        rooms: raw.rooms!,
        bathrooms: raw.bathrooms!,
        monthlyRent: raw.monthlyRent!,
      };

      const editingId = this.editingUnitId();
      if (editingId) {
        await this.unitService.update(editingId, payload);
      } else {
        const currentCount = (await firstValueFrom(this.units$)).length;
        await this.unitService.create(propertyId, payload);
        await this.propertyService.updateUnitCount(propertyId, currentCount + 1);
      }
      this.cancelUnitForm();
    } catch (err) {
      this.notifications.handleError(err, 'Could not save unit.');
    } finally {
      this.savingUnit.set(false);
    }
  }

  async deleteUnit(unit: Unit, propertyId: string): Promise<void> {
    if (unit.status === 'occupied') {
      window.alert('Cannot delete an occupied unit. Remove the tenant first.');
      return;
    }
    if (!window.confirm(`Delete "${unit.name}"? This cannot be undone.`)) return;

    try {
      const currentCount = (await firstValueFrom(this.units$)).length;
      await this.unitService.delete(unit.id);
      await this.propertyService.updateUnitCount(propertyId, Math.max(0, currentCount - 1));
    } catch (err) {
      this.notifications.handleError(err, 'Could not delete unit.');
    }
  }

  startEditTenant(tenant: Tenant): void {
    this.editingTenantId.set(tenant.id);
    this.editingTenantUnitId.set(tenant.unitId);
    this.tenantForm.patchValue({
      unitId: tenant.unitId,
      name: tenant.name,
      phone: tenant.phone,
      email: tenant.email ?? '',
      moveInDate: tenant.moveInDate.toISOString().split('T')[0],
      monthlyRent: tenant.monthlyRent,
      dueDay: tenant.dueDay,
    });
  }

  cancelTenantForm(): void {
    this.editingTenantId.set(null);
    this.editingTenantUnitId.set(null);
    this.tenantForm.reset({
      unitId: '',
      name: '',
      phone: '',
      email: '',
      moveInDate: new Date().toISOString().split('T')[0],
      monthlyRent: 0,
      dueDay: 1,
    });
  }

  async saveTenant(): Promise<void> {
    const editingId = this.editingTenantId();
    if (!editingId || this.tenantForm.invalid) return;

    this.savingTenant.set(true);
    try {
      const raw = this.tenantForm.getRawValue();
      const previousUnitId = this.editingTenantUnitId();

      if (previousUnitId && previousUnitId !== raw.unitId) {
        await this.unitService.update(previousUnitId, { status: 'vacant' });
        await this.unitService.update(raw.unitId, { status: 'occupied' });
      }

      await this.tenantService.update(editingId, {
        unitId: raw.unitId,
        name: raw.name.trim(),
        phone: raw.phone.trim(),
        email: raw.email?.trim() || undefined,
        moveInDate: new Date(raw.moveInDate),
        monthlyRent: Number(raw.monthlyRent),
        dueDay: Number(raw.dueDay),
      });
      this.cancelTenantForm();
      this.notifications.success('Tenant updated.');
    } catch (err) {
      this.notifications.handleError(err, 'Could not update tenant.');
    } finally {
      this.savingTenant.set(false);
    }
  }

  async deleteTenant(tenant: Tenant): Promise<void> {
    if (!window.confirm(`Remove "${tenant.name}" from this property?`)) return;

    await this.unitService.update(tenant.unitId, { status: 'vacant' });
    await this.tenantService.delete(tenant.id);
    if (this.editingTenantId() === tenant.id) {
      this.cancelTenantForm();
    }
  }

  startEditExpense(expense: Expense): void {
    this.editingExpenseId.set(expense.id);
    this.expenseForm.patchValue({
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date.toISOString().split('T')[0],
    });
  }

  cancelExpenseForm(): void {
    this.editingExpenseId.set(null);
    this.expenseForm.reset({
      category: 'water',
      amount: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  }

  async saveExpense(): Promise<void> {
    const editingId = this.editingExpenseId();
    if (!editingId || this.expenseForm.invalid) return;

    this.savingExpense.set(true);
    try {
      const raw = this.expenseForm.getRawValue();
      await this.expenseService.update(editingId, {
        category: raw.category,
        amount: raw.amount,
        description: raw.description,
        date: new Date(raw.date),
      });
      this.cancelExpenseForm();
    } finally {
      this.savingExpense.set(false);
    }
  }

  async deleteExpense(expense: Expense): Promise<void> {
    if (!window.confirm(`Delete this ${this.expenseLabels[expense.category]} expense?`)) return;

    await this.expenseService.delete(expense.id);
    if (this.editingExpenseId() === expense.id) {
      this.cancelExpenseForm();
    }
  }

  startEditBill(bill: SharedBill): void {
    this.editingBillId.set(bill.id);
    this.billForm.patchValue({
      type: bill.type,
      amount: bill.amount,
      households: bill.households,
      description: bill.description ?? '',
      date: bill.date.toISOString().split('T')[0],
    });
  }

  cancelBillForm(): void {
    this.editingBillId.set(null);
    this.billForm.reset({
      type: 'water',
      amount: 0,
      households: 1,
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  }

  async saveBill(): Promise<void> {
    const editingId = this.editingBillId();
    if (!editingId || this.billForm.invalid) return;

    this.savingBill.set(true);
    try {
      const raw = this.billForm.getRawValue();
      await this.sharedBillService.update(editingId, {
        type: raw.type,
        amount: raw.amount,
        households: raw.households,
        splitMethod: 'equal',
        description: raw.description || undefined,
        date: new Date(raw.date),
      });
      this.cancelBillForm();
    } finally {
      this.savingBill.set(false);
    }
  }

  async deleteBill(bill: SharedBill): Promise<void> {
    if (!window.confirm(`Delete this ${this.billLabels[bill.type]}?`)) return;

    await this.sharedBillService.delete(bill.id);
    if (this.editingBillId() === bill.id) {
      this.cancelBillForm();
    }
  }

}
