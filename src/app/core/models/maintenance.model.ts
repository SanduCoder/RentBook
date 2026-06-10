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
