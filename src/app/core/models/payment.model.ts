export type PaymentMethod = 'wave' | 'afrimoney' | 'qmoney' | 'bank_transfer' | 'cash';
export type PaymentStatus = 'paid' | 'upcoming' | 'late' | 'partial';

export interface Payment {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  amount: number;
  date: Date;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  status: PaymentStatus;
  receiptUrl?: string;
  recordedBy: string;
  createdAt: Date;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'wave', label: 'Wave' },
  { value: 'afrimoney', label: 'AfriMoney' },
  { value: 'qmoney', label: 'QMoney' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: 'Wave',
  afrimoney: 'AfriMoney',
  qmoney: 'QMoney',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
};
