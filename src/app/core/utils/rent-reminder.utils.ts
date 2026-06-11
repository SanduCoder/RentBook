export interface RentReminderDetails {
  tenantName: string;
  unitName: string;
  phone: string;
  monthlyRent: number;
  currency: string;
  dueDate: Date;
  isOverdue: boolean;
  landlordName?: string;
}

export function buildRentReminderMessage(details: RentReminderDetails): string {
  const amount = formatAmount(details.monthlyRent, details.currency);
  const dueText = details.isOverdue
    ? `was due on ${formatShortDate(details.dueDate)}`
    : `is due on ${formatShortDate(details.dueDate)}`;

  const greeting = details.landlordName
    ? `Hi ${details.tenantName}, this is ${details.landlordName} from RentBook.`
    : `Hi ${details.tenantName}, this is a reminder from your landlord via RentBook.`;

  return `${greeting}\n\nYour rent for ${details.unitName} (${amount}) ${dueText}. Please arrange payment at your earliest convenience.\n\nThank you.`;
}

export function openWhatsAppReminder(phone: string, message: string): void {
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

export function openSmsReminder(phone: string, message: string): void {
  const normalized = normalizePhone(phone);
  const uri = normalized
    ? `sms:${normalized}?body=${encodeURIComponent(message)}`
    : `sms:?body=${encodeURIComponent(message)}`;
  window.location.href = uri;
}

function formatAmount(amount: number, currency: string): string {
  const prefix = currency === 'GMD' ? 'D' : `${currency} `;
  return `${prefix}${amount.toLocaleString()}`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('220')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `220${digits.slice(1)}`;
  }

  if (digits.length === 7) {
    return `220${digits}`;
  }

  return digits;
}
