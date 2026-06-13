import { ActivityItem } from '../services/dashboard.service';

export interface PropertyActivity {
  id: string;
  type: 'payment' | 'reminder';
  message: string;
  timestamp: Date;
  amount?: number;
  tenantId?: string;
}

export interface ActivityRouteLink {
  commands: string[];
  queryParams?: Record<string, string>;
}

export function dashboardActivityLink(
  item: ActivityItem,
  options?: { isTenant?: boolean }
): ActivityRouteLink {
  if (item.type === 'maintenance') {
    return { commands: ['/requests'], queryParams: { id: item.id } };
  }

  if (item.type === 'overdue' && item.tenantId) {
    return { commands: ['/tenants', item.tenantId] };
  }

  if (item.type === 'payment') {
    if (options?.isTenant) {
      return { commands: ['/my-payments'], queryParams: { id: item.id } };
    }
    return { commands: ['/payments'], queryParams: { id: item.id } };
  }

  if (item.type === 'reminder' && item.tenantId) {
    return { commands: ['/tenants', item.tenantId] };
  }

  return { commands: ['/payments'] };
}

export function propertyActivityLink(item: PropertyActivity): ActivityRouteLink {
  if (item.type === 'reminder' && item.tenantId) {
    return { commands: ['/tenants', item.tenantId] };
  }
  return { commands: ['/payments'], queryParams: { id: item.id } };
}
