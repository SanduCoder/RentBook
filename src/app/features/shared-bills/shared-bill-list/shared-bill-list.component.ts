import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PropertyService } from '../../../core/services/property.service';
import { SharedBillService } from '../../../core/services/shared-bill.service';
import {
  SHARED_BILL_TYPE_LABELS,
  SharedBillType,
  calculatePerHousehold,
} from '../../../core/models/shared-bill.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Icon3dComponent } from '../../../shared/components/icon-3d/icon-3d.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

interface SharedBillListItem {
  id: string;
  propertyId: string;
  type: SharedBillType;
  amount: number;
  households: number;
  description?: string;
  date: Date;
  propertyName: string;
  perHousehold: number;
}

interface SharedBillListData {
  currency: string;
  items: SharedBillListItem[];
}

@Component({
  selector: 'app-shared-bill-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, EmptyStateComponent, CurrencyFormatPipe, Icon3dComponent],
  templateUrl: './shared-bill-list.component.html',
  styleUrl: './shared-bill-list.component.scss',
})
export class SharedBillListComponent {
  private auth = inject(AuthService);
  private propertyService = inject(PropertyService);
  private sharedBillService = inject(SharedBillService);

  typeLabels = SHARED_BILL_TYPE_LABELS;

  bills$ = this.propertyService.getByOwner(this.auth.currentUser()?.id ?? '').pipe(
    switchMap((properties) => {
      const propertyMap = new Map(properties.map((p) => [p.id, p.name]));
      const currency = properties[0]?.currency ?? 'GMD';
      return this.sharedBillService.getByOwnerProperties(properties.map((p) => p.id)).pipe(
        map((bills) => ({
          currency,
          items: bills.map((b) => ({
            ...b,
            propertyName: propertyMap.get(b.propertyId) ?? 'Unknown',
            perHousehold: calculatePerHousehold(b.amount, b.households),
          })),
        }))
      );
    })
  );

  totalAmount(data: SharedBillListData): number {
    return data.items.reduce((sum, bill) => sum + bill.amount, 0);
  }

  totalHouseholds(items: SharedBillListItem[]): number {
    return items.reduce((sum, bill) => sum + bill.households, 0);
  }

  typeClass(type: SharedBillType): string {
    return `thumb-${type}`;
  }

  countByType(items: SharedBillListItem[], type: SharedBillType): number {
    return items.filter((bill) => bill.type === type).length;
  }
}
