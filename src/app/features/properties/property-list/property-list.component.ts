import { AsyncPipe } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, map, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PROPERTY_TYPE_LABELS, Property, PropertyType } from '../../../core/models/property.model';
import { PropertyService } from '../../../core/services/property.service';
import { UnitService } from '../../../core/services/unit.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Icon3dComponent } from '../../../shared/components/icon-3d/icon-3d.component';

interface PropertyWithStats extends Property {
  occupiedCount: number;
  vacantCount: number;
  totalCount: number;
}

interface PortfolioSummary {
  propertyCount: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
}

@Component({
  selector: 'app-property-list',
  standalone: true,
  imports: [AsyncPipe, RouterLink, EmptyStateComponent, Icon3dComponent],
  templateUrl: './property-list.component.html',
  styleUrl: './property-list.component.scss',
})
export class PropertyListComponent {
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private unitService = inject(UnitService);
  private router = inject(Router);

  openMenuId = signal<string | null>(null);

  properties$: Observable<PropertyWithStats[]> = toObservable(this.auth.currentUser).pipe(
    switchMap((user) => {
      if (!user) return of([]);

      return this.propertyService.getByOwner(user.id).pipe(
        switchMap((properties) => {
          if (properties.length === 0) return of([]);

          const withUnits = properties.map((p) =>
            this.unitService.getByProperty(p.id).pipe(
              map((units) => {
                const occupiedCount = units.filter((u) => u.status === 'occupied').length;
                const totalCount = units.length;
                return {
                  ...p,
                  occupiedCount,
                  vacantCount: totalCount - occupiedCount,
                  totalCount,
                };
              })
            )
          );
          return combineLatest(withUnits);
        })
      );
    })
  );

  @HostListener('document:click')
  closeMenu(): void {
    this.openMenuId.set(null);
  }

  portfolioSummary(properties: PropertyWithStats[]): PortfolioSummary {
    const totalUnits = properties.reduce((sum, property) => sum + property.totalCount, 0);
    const occupiedUnits = properties.reduce((sum, property) => sum + property.occupiedCount, 0);

    return {
      propertyCount: properties.length,
      totalUnits,
      occupiedUnits,
      occupancyRate: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
    };
  }

  occupancyRate(property: PropertyWithStats): number {
    return property.totalCount
      ? Math.round((property.occupiedCount / property.totalCount) * 100)
      : 0;
  }

  toggleMenu(propertyId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === propertyId ? null : propertyId);
  }

  editProperty(propertyId: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(null);
    this.router.navigate(['/properties', propertyId, 'edit']);
  }

  async deleteProperty(property: PropertyWithStats, event: Event): Promise<void> {
    event.stopPropagation();
    this.openMenuId.set(null);

    if (property.totalCount > 0) {
      window.alert(
        `Cannot delete "${property.name}" while it has ${property.totalCount} unit(s). Remove all units first.`
      );
      return;
    }

    if (!window.confirm(`Delete "${property.name}"? This cannot be undone.`)) return;

    await this.propertyService.delete(property.id);
  }

  unitLabel(property: PropertyWithStats): string {
    const count = property.totalCount;
    const word = this.unitWord(property.type, count);
    return `${count} ${word}`;
  }

  locationLabel(property: PropertyWithStats): string {
    const parts = property.address.split(',').map((p) => p.trim()).filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : property.address;
  }

  typeLabel(type: PropertyType): string {
    return PROPERTY_TYPE_LABELS[type];
  }

  thumbnailEmoji(type: PropertyType): string {
    const map: Record<PropertyType, string> = {
      compound: '🏘️',
      apartment: '🏢',
      room: '🛏️',
      shop: '🏪',
      office: '🏛️',
    };
    return map[type];
  }

  thumbClass(property: PropertyWithStats): string {
    return property.imageUrl ? 'thumb-photo' : `thumb-${property.type}`;
  }

  occupancyBadgeClass(property: PropertyWithStats): string {
    const rate = this.occupancyRate(property);
    if (rate === 100) return 'full';
    if (rate === 0) return 'empty';
    return 'partial';
  }

  unitWord(type: PropertyType, count: number): string {
    const plural = count === 1;
    const map: Record<PropertyType, [string, string]> = {
      compound: ['Room', 'Rooms'],
      apartment: ['Unit', 'Units'],
      room: ['Room', 'Rooms'],
      shop: ['Shop', 'Shops'],
      office: ['Office', 'Offices'],
    };
    const [singular, pluralForm] = map[type];
    return plural ? singular : pluralForm;
  }
}
