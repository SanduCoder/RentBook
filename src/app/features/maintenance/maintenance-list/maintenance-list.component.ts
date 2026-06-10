import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ErrorNotificationService } from '../../../core/services/error-notification.service';
import { MaintenanceService } from '../../../core/services/maintenance.service';
import { PropertyService } from '../../../core/services/property.service';
import { TenantService } from '../../../core/services/tenant.service';
import { UnitService } from '../../../core/services/unit.service';
import { isTenant } from '../../../core/utils/role.utils';
import {
  MaintenanceCategory,
  MaintenanceRequest,
  MaintenanceStatus,
} from '../../../core/models/maintenance.model';
import { Icon3dComponent } from '../../../shared/components/icon-3d/icon-3d.component';

interface MaintenanceWithMeta extends MaintenanceRequest {
  propertyName: string;
  unitName?: string;
  displayTenantName?: string;
}

type StatusFilter = MaintenanceStatus;

@Component({
  selector: 'app-maintenance-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, Icon3dComponent],
  templateUrl: './maintenance-list.component.html',
  styleUrl: './maintenance-list.component.scss',
})
export class MaintenanceListComponent {
  private auth = inject(AuthService);
  private notifications = inject(ErrorNotificationService);
  private propertyService = inject(PropertyService);
  private maintenanceService = inject(MaintenanceService);
  private tenantService = inject(TenantService);
  private unitService = inject(UnitService);

  filter = signal<StatusFilter>('open');
  updating = signal<string | null>(null);

  tabs: { id: StatusFilter; label: string }[] = [
    { id: 'open', label: 'Open' },
    { id: 'assigned', label: 'In Progress' },
    { id: 'completed', label: 'Completed' },
  ];

  requests$ = toObservable(this.auth.currentUser).pipe(
    switchMap((user) => {
      if (!user) return of([] as MaintenanceWithMeta[]);

      if (isTenant(user.role) && user.tenantRecordId) {
        return this.maintenanceService.getByTenantRecord(user.tenantRecordId).pipe(
          map((requests) =>
            requests.map((request) => ({
              ...request,
              propertyName: 'My property',
              displayTenantName: user.name,
            }))
          )
        );
      }

      return this.propertyService.getByOwner(user.id).pipe(
        switchMap((properties) => {
          if (properties.length === 0) return of([] as MaintenanceWithMeta[]);

          const propertyMap = new Map(properties.map((p) => [p.id, p.name]));
          const propertyIds = properties.map((p) => p.id);

          return combineLatest([
            this.maintenanceService.getByOwnerProperties(propertyIds),
            combineLatest(properties.map((p) => this.tenantService.getByProperty(p.id))),
            combineLatest(properties.map((p) => this.unitService.getByProperty(p.id))),
          ]).pipe(
            map(([requests, tenantGroups, unitGroups]) => {
              const tenants = tenantGroups.flat();
              const units = unitGroups.flat();
              const tenantMap = new Map(tenants.map((t) => [t.id, t]));
              const unitMap = new Map(units.map((u) => [u.id, u]));

              return requests.map((request) => {
                const tenant = tenantMap.get(request.tenantId);
                const unit = tenant ? unitMap.get(tenant.unitId) : undefined;

                return {
                  ...request,
                  propertyName: propertyMap.get(request.propertyId) ?? 'Unknown',
                  unitName: unit?.name,
                  displayTenantName: request.tenantName ?? tenant?.name,
                } satisfies MaintenanceWithMeta;
              });
            })
          );
        })
      );
    })
  );

  setFilter(value: StatusFilter): void {
    this.filter.set(value);
  }

  filteredRequests(requests: MaintenanceWithMeta[]): MaintenanceWithMeta[] {
    return requests.filter((request) => request.status === this.filter());
  }

  countByStatus(requests: MaintenanceWithMeta[], status: MaintenanceStatus): number {
    return requests.filter((request) => request.status === status).length;
  }

  subtitleLine(request: MaintenanceWithMeta): string {
    const parts: string[] = [];
    if (request.unitName) parts.push(request.unitName);
    if (request.displayTenantName) parts.push(`Reported by ${request.displayTenantName}`);
    return parts.join(' • ') || request.propertyName;
  }

  categoryShortLabel(category: MaintenanceCategory): string {
    const map: Record<MaintenanceCategory, string> = {
      water: 'Plumbing',
      leak: 'Plumbing',
      electricity: 'Electrical',
      broken_door: 'Structural',
      other: 'General',
    };
    return map[category];
  }

  priorityLabel(category: MaintenanceCategory): string {
    const map: Record<MaintenanceCategory, string> = {
      water: 'Medium',
      leak: 'High',
      electricity: 'High',
      broken_door: 'Medium',
      other: 'Low',
    };
    return map[category];
  }

  priorityClass(category: MaintenanceCategory): string {
    const label = this.priorityLabel(category);
    return `priority-${label.toLowerCase()}`;
  }

  statusLabel(status: MaintenanceStatus): string {
    if (status === 'assigned') return 'In Progress';
    if (status === 'completed') return 'Completed';
    return 'Open';
  }

  thumbnailEmoji(category: MaintenanceCategory): string {
    const map: Record<MaintenanceCategory, string> = {
      water: '💧',
      electricity: '💡',
      leak: '🚿',
      broken_door: '🚪',
      other: '🔧',
    };
    return map[category];
  }

  async advanceStatus(request: MaintenanceWithMeta): Promise<void> {
    const next = this.nextStatus(request.status);
    if (!next) return;

    this.updating.set(request.id);
    try {
      await this.maintenanceService.updateStatus(request.id, next);
      if (next !== this.filter()) {
        this.filter.set(next);
      }
    } catch (error) {
      this.notifications.handleError(error, 'Could not update request status.');
    } finally {
      this.updating.set(null);
    }
  }

  nextStatus(current: MaintenanceStatus): MaintenanceStatus | null {
    if (current === 'open') return 'assigned';
    if (current === 'assigned') return 'completed';
    return null;
  }

  advanceLabel(current: MaintenanceStatus): string {
    if (current === 'open') return 'Start Progress';
    if (current === 'assigned') return 'Mark Completed';
    return '';
  }
}
