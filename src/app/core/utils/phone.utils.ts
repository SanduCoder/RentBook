import { getCountryProfile } from '../config/country-profiles.config';

export function normalizePhone(phone: string, countryCode?: string | null): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  const dialDigits = getCountryProfile(countryCode).dialCode.replace(/\D/g, '');

  if (digits.startsWith(dialDigits)) {
    return digits;
  }

  const local = digits.startsWith('0') ? digits.slice(1) : digits;

  if (local.startsWith(dialDigits)) {
    return local;
  }

  return `${dialDigits}${local}`;
}
