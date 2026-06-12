export type MaintenanceStatus = 'open' | 'assigned' | 'completed';

export type MaintenanceCategory =
  | 'water'
  | 'electricity'
  | 'leak'
  | 'broken_door'
  | 'other';

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  tenantId: string;
  tenantName?: string;
  title: string;
  description: string;
  category: MaintenanceCategory;
  photos: string[];
  status: MaintenanceStatus;
  reportedBy?: string;
  reportedByTenant?: boolean;
  createdAt: Date;
}

export const MAINTENANCE_CATEGORIES: { value: MaintenanceCategory; label: string }[] = [
  { value: 'water', label: 'Water Issue' },
  { value: 'electricity', label: 'Electricity Issue' },
  { value: 'leak', label: 'Leak' },
  { value: 'broken_door', label: 'Broken Door / Lock' },
  { value: 'other', label: 'Other' },
];

export const MAINTENANCE_CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  water: 'Water Issue',
  electricity: 'Electricity Issue',
  leak: 'Leak',
  broken_door: 'Broken Door / Lock',
  other: 'Other',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open: 'Open',
  assigned: 'In Progress',
  completed: 'Completed',
};

export function maintenanceStatusTone(status: MaintenanceStatus): 'success' | 'warning' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'assigned') return 'info';
  return 'warning';
}

export function maintenanceCategoryIcon(category: MaintenanceCategory): string {
  const map: Record<MaintenanceCategory, string> = {
    water: '💧',
    electricity: '💡',
    leak: '🚿',
    broken_door: '🚪',
    other: '🔧',
  };
  return map[category];
}

export type MaintenanceReportedByViewer = 'owner' | 'tenant';

/** Who submitted this maintenance request. */
export function maintenanceReportedByLabel(
  request: MaintenanceRequest,
  options?: { viewer?: MaintenanceReportedByViewer; ownerId?: string; tenantUserId?: string }
): string {
  const legacyTenantReport = !request.reportedBy && !!request.tenantId;
  if (request.reportedByTenant || legacyTenantReport) {
    if (options?.viewer === 'tenant' && options.tenantUserId && request.reportedBy === options.tenantUserId) {
      return 'Reported by you';
    }
    return 'Reported by tenant';
  }
  if (options?.tenantUserId && request.reportedBy === options.tenantUserId) {
    return 'Reported by you';
  }
  if (options?.ownerId && request.reportedBy === options.ownerId) {
    return options.viewer === 'tenant' ? 'Recorded by landlord' : 'Recorded by you';
  }
  if (request.tenantId) {
    return 'Reported by tenant';
  }
  return options?.viewer === 'tenant' ? 'Recorded by landlord' : 'Recorded by you';
}
