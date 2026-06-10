import { ActivityItem } from '../services/dashboard.service';

export interface PropertyActivity {
  id: string;
  type: 'payment';
  message: string;
  timestamp: Date;
  amount?: number;
  tenantId?: string;
}

export function dashboardActivityLink(
  item: ActivityItem,
  options?: { isTenant?: boolean }
): string[] {
  if (item.type === 'maintenance') return ['/requests'];
  if (options?.isTenant) return ['/my-payments'];
  if (item.tenantId) return ['/tenants', item.tenantId];
  return ['/payments'];
}

export function propertyActivityLink(item: PropertyActivity): string[] {
  if (item.tenantId) return ['/tenants', item.tenantId];
  return ['/payments'];
}
