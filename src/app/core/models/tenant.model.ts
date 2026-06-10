export interface Tenant {
  id: string;
  unitId: string;
  propertyId: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  occupation?: string;
  moveInDate: Date;
  monthlyRent: number;
  dueDay: number;
  active: boolean;
  pendingAssignment?: boolean;
}
