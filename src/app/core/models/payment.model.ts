export type PaymentMethod =
  | 'wave'
  | 'afrimoney'
  | 'qmoney'
  | 'mpesa'
  | 'mtn_momo'
  | 'orange_money'
  | 'airtel_money'
  | 'bank_transfer'
  | 'cash'
  | 'card'
  | 'zelle'
  | 'venmo'
  | 'cash_app'
  | 'other';

export type PaymentStatus = 'paid' | 'upcoming' | 'late' | 'partial' | 'pending_verification';

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
  reportedByTenant?: boolean;
  createdAt: Date;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  upcoming: 'Upcoming',
  late: 'Late',
  pending_verification: 'Pending verification',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: 'Wave',
  afrimoney: 'AfriMoney',
  qmoney: 'QMoney',
  mpesa: 'M-Pesa',
  mtn_momo: 'MTN MoMo',
  orange_money: 'Orange Money',
  airtel_money: 'Airtel Money',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  card: 'Card',
  zelle: 'Zelle',
  venmo: 'Venmo',
  cash_app: 'Cash App',
  other: 'Other',
};

/** @deprecated Use CountryProfileService.paymentMethodsForCountry instead. */
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'wave', label: PAYMENT_METHOD_LABELS.wave },
  { value: 'afrimoney', label: PAYMENT_METHOD_LABELS.afrimoney },
  { value: 'qmoney', label: PAYMENT_METHOD_LABELS.qmoney },
  { value: 'bank_transfer', label: PAYMENT_METHOD_LABELS.bank_transfer },
  { value: 'cash', label: PAYMENT_METHOD_LABELS.cash },
];

export function paymentMethodLabel(method: PaymentMethod | string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? String(method).replace(/_/g, ' ');
}

/** When this payment was logged in RentBook — use for activity feeds and list ordering. */
export function paymentRecordedAt(payment: Payment): Date {
  return payment.createdAt ?? payment.date;
}

export type PaymentRecordedByViewer = 'owner' | 'tenant';

/** Who logged this payment — tenant report vs landlord record. */
export function paymentRecordedByLabel(
  payment: Payment,
  options?: { viewer?: PaymentRecordedByViewer; ownerId?: string; tenantUserId?: string }
): string {
  if (payment.reportedByTenant || payment.status === 'pending_verification') {
    return 'Reported by tenant';
  }
  if (options?.tenantUserId && payment.recordedBy === options.tenantUserId) {
    return 'Recorded by tenant';
  }
  if (options?.ownerId && payment.recordedBy === options.ownerId) {
    return options.viewer === 'tenant' ? 'Recorded by landlord' : 'Recorded by you';
  }
  return 'Recorded by landlord';
}
