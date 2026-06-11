import { AsyncPipe, DatePipe, NgStyle } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';
import { Property } from '../../../core/models/property.model';
import { Tenant } from '../../../core/models/tenant.model';
import { Unit } from '../../../core/models/unit.model';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PropertyService } from '../../../core/services/property.service';
import { RentReminderService } from '../../../core/services/rent-reminder.service';
import { PendingTenantUser, UserService } from '../../../core/services/user.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UnitService } from '../../../core/services/unit.service';
import { getAvatarColors, getInitials } from '../../../core/utils/avatar.utils';
import {
  TenantRentStatus,
  TenantRentStatusInfo,
  getTenantRentStatus,
} from '../../../core/utils/tenant-status.utils';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

interface TenantListItem {
  tenant: Tenant;
  unitName: string;
  propertyName: string;
  currency: string;
  rentStatus: TenantRentStatusInfo;
}

interface TenantSection {
  key: TenantRentStatus;
  title: string;
  items: TenantListItem[];
}

interface CollectionSummary {
  currency: string;
  totalUnpaid: number;
  overdueCount: number;
  dueSoonCount: number;
  unpaidCount: number;
}

@Component({
  selector: 'app-tenant-list',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    NgStyle,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CurrencyFormatPipe,
    EmptyStateComponent,
  ],
  templateUrl: './tenant-list.component.html',
  styleUrl: './tenant-list.component.scss',
})
export class TenantListComponent {
  private auth = inject(AuthService);
  private rentReminders = inject(RentReminderService);
  private notifications = inject(ErrorNotificationService);
  private fb = inject(FormBuilder);
  private propertyService = inject(PropertyService);
  private tenantService = inject(TenantService);
  private unitService = inject(UnitService);
  private paymentService = inject(PaymentService);
  private userService = inject(UserService);

  search = signal('');
  assigningUserId = signal<string | null>(null);
  assignError = signal('');
  assigning = signal(false);

  private ownerId = this.auth.currentUser()?.id ?? '';

  properties$ = this.ownerId
    ? this.propertyService.getByOwner(this.ownerId)
    : of([] as Property[]);

  pendingTenants$ = this.ownerId
    ? this.userService.getPendingByOwner(this.ownerId)
    : of([] as PendingTenantUser[]);

  tenants$ = this.propertyService.getByOwner(this.ownerId).pipe(
    switchMap((properties) => {
      if (properties.length === 0) return of([] as TenantListItem[]);

      const propertyMap = new Map(properties.map((p) => [p.id, p]));
      const propertyIds = properties.map((p) => p.id);

      return combineLatest([
        this.tenantService.getByOwnerProperties(propertyIds),
        combineLatest(properties.map((p) => this.unitService.getByProperty(p.id))),
        this.paymentService.getByOwnerProperties(propertyIds),
      ]).pipe(
        map(([tenants, unitGroups, payments]) => {
          const unitMap = new Map(unitGroups.flat().map((u) => [u.id, u]));

          return tenants.map((tenant) => {
            const property = propertyMap.get(tenant.propertyId);
            const unit = unitMap.get(tenant.unitId);
            const tenantPayments = payments.filter((p) => p.tenantId === tenant.id);

            return {
              tenant,
              unitName: unit?.name ?? 'Unit',
              propertyName: property?.name ?? 'Property',
              currency: property?.currency ?? 'GMD',
              rentStatus: getTenantRentStatus(tenant, tenantPayments),
            } satisfies TenantListItem;
          });
        })
      );
    })
  );

  assignForm = this.fb.nonNullable.group({
    propertyId: ['', Validators.required],
    unitId: ['', Validators.required],
    monthlyRent: [0, [Validators.required, Validators.min(0)]],
    dueDay: [1, [Validators.required, Validators.min(1), Validators.max(28)]],
    moveInDate: [new Date().toISOString().split('T')[0], Validators.required],
  });

  vacantUnits = signal<Unit[]>([]);

  filterTenants(items: TenantListItem[]): TenantListItem[] {
    const query = this.search().trim().toLowerCase();
    if (!query) return items;

    return items.filter(
      (item) =>
        item.tenant.name.toLowerCase().includes(query) ||
        item.unitName.toLowerCase().includes(query) ||
        item.propertyName.toLowerCase().includes(query) ||
        item.tenant.phone.includes(query)
    );
  }

  collectionSummary(items: TenantListItem[]): CollectionSummary | null {
    const filtered = this.filterTenants(items);
    if (filtered.length === 0) return null;

    const unpaid = filtered.filter((item) => item.rentStatus.status !== 'paid');
    return {
      currency: filtered[0].currency,
      totalUnpaid: unpaid.reduce((sum, item) => sum + item.tenant.monthlyRent, 0),
      overdueCount: unpaid.filter((item) => item.rentStatus.status === 'overdue').length,
      dueSoonCount: unpaid.filter((item) => item.rentStatus.status === 'due_soon').length,
      unpaidCount: unpaid.length,
    };
  }

  groupTenants(items: TenantListItem[]): TenantSection[] {
    const filtered = this.filterTenants(items);
    const buckets: Record<TenantRentStatus, TenantListItem[]> = {
      overdue: [],
      due_soon: [],
      upcoming: [],
      paid: [],
    };

    for (const item of filtered) {
      buckets[item.rentStatus.status].push(item);
    }

    const sections: TenantSection[] = [];
    if (buckets.overdue.length) {
      sections.push({ key: 'overdue', title: 'Overdue', items: buckets.overdue });
    }
    if (buckets.due_soon.length) {
      sections.push({ key: 'due_soon', title: 'Due soon', items: buckets.due_soon });
    }
    if (buckets.upcoming.length) {
      sections.push({ key: 'upcoming', title: 'Upcoming', items: buckets.upcoming });
    }
    if (buckets.paid.length) {
      sections.push({ key: 'paid', title: 'Paid this month', items: buckets.paid });
    }
    return sections;
  }

  tenantInitials(name: string): string {
    return getInitials(name);
  }

  avatarStyle(name: string): { background: string; color: string } {
    return getAvatarColors(name);
  }

  filterPending(items: PendingTenantUser[]): PendingTenantUser[] {
    const query = this.search().trim().toLowerCase();
    if (!query) return items;

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.phone.includes(query) ||
        item.email.toLowerCase().includes(query)
    );
  }

  startAssign(userId: string): void {
    this.assigningUserId.set(this.assigningUserId() === userId ? null : userId);
    this.assignError.set('');
    this.assignForm.reset({
      propertyId: '',
      unitId: '',
      monthlyRent: 0,
      dueDay: 1,
      moveInDate: new Date().toISOString().split('T')[0],
    });
    this.vacantUnits.set([]);
  }

  async onAssignPropertyChange(propertyId: string): Promise<void> {
    this.assignForm.patchValue({ propertyId, unitId: '', monthlyRent: 0 });
    if (!propertyId) {
      this.vacantUnits.set([]);
      return;
    }

    const units = await firstValueFrom(this.unitService.getByProperty(propertyId));
    this.vacantUnits.set(units.filter((unit) => unit.status === 'vacant'));
  }

  onAssignUnitSelected(unitId: string): void {
    const unit = this.vacantUnits().find((item) => item.id === unitId);
    if (unit) {
      this.assignForm.patchValue({ monthlyRent: unit.monthlyRent });
    }
  }

  async submitAssign(user: PendingTenantUser): Promise<void> {
    if (this.assignForm.invalid || !this.ownerId) return;

    this.assigning.set(true);
    this.assignError.set('');

    try {
      const raw = this.assignForm.getRawValue();
      await this.tenantService.assignPendingUser(this.ownerId, user.id, {
        propertyId: raw.propertyId,
        unitId: raw.unitId,
        monthlyRent: raw.monthlyRent,
        dueDay: raw.dueDay,
        moveInDate: new Date(raw.moveInDate),
      });
      this.assigningUserId.set(null);
    } catch (err) {
      this.assignError.set(err instanceof Error ? err.message : 'Could not assign tenant.');
    } finally {
      this.assigning.set(false);
    }
  }

  canSendReminder(status: TenantRentStatusInfo): boolean {
    return status.status === 'overdue' || status.status === 'due_soon';
  }

  async sendReminder(item: TenantListItem): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;

    try {
      await this.rentReminders.sendForTenant(
        item.tenant,
        item.unitName,
        item.currency,
        item.rentStatus,
        { id: user.id, name: user.name?.trim() || 'Your landlord' }
      );
      this.notifications.success('Reminder saved in RentBook and sent via WhatsApp.');
    } catch {
      this.notifications.show('Could not send reminder. Try again.');
    }
  }
}
