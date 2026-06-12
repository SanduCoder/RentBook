import { Timestamp } from 'firebase/firestore';
import { localeForCurrency } from '../config/country-profiles.config';

export function toDate(value: unknown, fallback?: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (fallback !== undefined) {
    return toDate(fallback);
  }
  return new Date();
}

export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export function formatCurrency(amount: number, currency = 'GMD', locale?: string): string {
  const resolvedLocale = locale ?? localeForCurrency(currency);
  const fractionDigits = ['JPY', 'KRW', 'XOF', 'XAF', 'GMD'].includes(currency) ? 0 : 2;

  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(resolvedLocale)}`;
  }
}

export function getMonthStart(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
}
