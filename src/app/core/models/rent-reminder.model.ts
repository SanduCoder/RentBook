export interface RentReminder {
  id: string;
  tenantId: string;
  propertyId: string;
  recipientUserId?: string;
  unitName: string;
  message: string;
  monthlyRent: number;
  currency: string;
  dueDate: Date;
  isOverdue: boolean;
  read: boolean;
  sentBy: string;
  sentByName: string;
  createdAt: Date;
}
