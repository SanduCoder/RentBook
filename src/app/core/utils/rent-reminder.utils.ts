import { formatCurrency } from './firestore.utils';
import { normalizePhone } from './phone.utils';

export interface RentReminderDetails {
  tenantName: string;
  unitName: string;
  phone: string;
  monthlyRent: number;
  currency: string;
  countryCode?: string;
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

export function openWhatsAppReminder(
  phone: string,
  message: string,
  countryCode?: string | null
): void {
  const normalized = normalizePhone(phone, countryCode);
  if (!normalized) return;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

export function openSmsReminder(phone: string, message: string, countryCode?: string | null): void {
  const normalized = normalizePhone(phone, countryCode);
  const uri = normalized
    ? `sms:${normalized}?body=${encodeURIComponent(message)}`
    : `sms:?body=${encodeURIComponent(message)}`;
  window.location.href = uri;
}

function formatAmount(amount: number, currency: string): string {
  return formatCurrency(amount, currency);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
