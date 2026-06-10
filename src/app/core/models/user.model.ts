export type UserRole = 'owner' | 'caretaker' | 'property_manager' | 'tenant';

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  photoUrl?: string;
  linkedOwnerId?: string;
  linkedPropertyId?: string;
  tenantRecordId?: string;
  createdAt: Date;
}
