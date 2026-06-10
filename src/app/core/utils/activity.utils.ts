import { ActivityItem } from '../services/dashboard.service';

export interface PropertyActivity {
  id: string;
  type: 'payment';
  message: string;
  timestamp: Date;
  amount?: number;
  tenantId?: string;
}

export function dashboardActivityLink(item: ActivityItem): string[] {
  if (item.type === 'maintenance') return ['/requests'];
  if (item.tenantId) return ['/tenants', item.tenantId];
  return ['/payments'];
}

export function propertyActivityLink(item: PropertyActivity): string[] {
  if (item.tenantId) return ['/tenants', item.tenantId];
  return ['/payments'];
}
