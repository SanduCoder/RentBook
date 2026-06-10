import { AppUser, UserRole } from '../models/user.model';

const TENANT_MANAGER_ROLES: UserRole[] = ['owner', 'caretaker', 'property_manager'];

export function canManageTenants(role?: UserRole | null): boolean {
  return !!role && TENANT_MANAGER_ROLES.includes(role);
}

export function isTenant(role?: UserRole | null): boolean {
  return role === 'tenant';
}

/** Linked to a landlord via owner code, but no property/unit assigned yet. */
export function hasPendingTenancyLink(user?: AppUser | null): boolean {
  return !!user?.linkedOwnerId && !user?.tenantRecordId;
}

export function isTenancyLinked(user?: AppUser | null): boolean {
  return !!user?.tenantRecordId;
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    owner: 'Owner',
    caretaker: 'Caretaker',
    property_manager: 'Property Manager',
    tenant: 'Tenant',
  };
  return labels[role] ?? role;
}
