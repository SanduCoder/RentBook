export interface AuditLog {
  id: string;
  propertyId: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: Date;
  details?: string;
}
