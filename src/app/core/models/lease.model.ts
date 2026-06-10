export type LeaseStatus = 'active' | 'expired' | 'terminated';

export interface Lease {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  depositAmount: number;
  depositPaid: number;
  depositRefunded: number;
  depositDeductions: number;
  status: LeaseStatus;
}
