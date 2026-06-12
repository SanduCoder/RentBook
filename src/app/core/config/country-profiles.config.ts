import { PaymentMethod } from '../models/payment.model';

export interface CurrencyOption {
  code: string;
  name: string;
}

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
}

export interface CountryProfile {
  code: string;
  name: string;
  locale: string;
  defaultCurrency: string;
  currencies: CurrencyOption[];
  dialCode: string;
  paymentMethods: PaymentMethodOption[];
}

const universalMethods: PaymentMethodOption[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export const DEFAULT_COUNTRY_CODE = 'GM';

export const COUNTRY_PROFILES: CountryProfile[] = [
  {
    code: 'GM',
    name: 'Gambia',
    locale: 'en-GM',
    defaultCurrency: 'GMD',
    currencies: [{ code: 'GMD', name: 'Gambian Dalasi' }],
    dialCode: '+220',
    paymentMethods: [
      { value: 'wave', label: 'Wave' },
      { value: 'afrimoney', label: 'AfriMoney' },
      { value: 'qmoney', label: 'QMoney' },
      ...universalMethods,
    ],
  },
  {
    code: 'SN',
    name: 'Senegal',
    locale: 'fr-SN',
    defaultCurrency: 'XOF',
    currencies: [{ code: 'XOF', name: 'West African CFA Franc' }],
    dialCode: '+221',
    paymentMethods: [
      { value: 'wave', label: 'Wave' },
      { value: 'orange_money', label: 'Orange Money' },
      ...universalMethods,
    ],
  },
  {
    code: 'NG',
    name: 'Nigeria',
    locale: 'en-NG',
    defaultCurrency: 'NGN',
    currencies: [{ code: 'NGN', name: 'Nigerian Naira' }],
    dialCode: '+234',
    paymentMethods: [...universalMethods],
  },
  {
    code: 'GH',
    name: 'Ghana',
    locale: 'en-GH',
    defaultCurrency: 'GHS',
    currencies: [{ code: 'GHS', name: 'Ghanaian Cedi' }],
    dialCode: '+233',
    paymentMethods: [
      { value: 'mtn_momo', label: 'MTN MoMo' },
      ...universalMethods,
    ],
  },
  {
    code: 'KE',
    name: 'Kenya',
    locale: 'en-KE',
    defaultCurrency: 'KES',
    currencies: [{ code: 'KES', name: 'Kenyan Shilling' }],
    dialCode: '+254',
    paymentMethods: [
      { value: 'mpesa', label: 'M-Pesa' },
      ...universalMethods,
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    locale: 'en-GB',
    defaultCurrency: 'GBP',
    currencies: [{ code: 'GBP', name: 'British Pound' }],
    dialCode: '+44',
    paymentMethods: [
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'card', label: 'Card' },
      { value: 'cash', label: 'Cash' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    locale: 'en-US',
    defaultCurrency: 'USD',
    currencies: [{ code: 'USD', name: 'US Dollar' }],
    dialCode: '+1',
    paymentMethods: [
      { value: 'zelle', label: 'Zelle' },
      { value: 'venmo', label: 'Venmo' },
      { value: 'cash_app', label: 'Cash App' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'card', label: 'Card' },
      { value: 'cash', label: 'Cash' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    locale: 'fr-FR',
    defaultCurrency: 'EUR',
    currencies: [{ code: 'EUR', name: 'Euro' }],
    dialCode: '+33',
    paymentMethods: [
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'card', label: 'Card' },
      { value: 'cash', label: 'Cash' },
      { value: 'other', label: 'Other' },
    ],
  },
];

const profileByCode = new Map(COUNTRY_PROFILES.map((profile) => [profile.code, profile]));

export function getCountryProfile(countryCode?: string | null): CountryProfile {
  const code = countryCode?.toUpperCase();
  if (code) {
    const profile = profileByCode.get(code);
    if (profile) {
      return profile;
    }
  }
  return profileByCode.get(DEFAULT_COUNTRY_CODE)!;
}

export function resolveCountryCode(value?: string | null): string {
  if (!value?.trim()) {
    return DEFAULT_COUNTRY_CODE;
  }

  const normalized = value.trim();
  const byCode = profileByCode.get(normalized.toUpperCase());
  if (byCode) {
    return byCode.code;
  }

  const byName = COUNTRY_PROFILES.find(
    (profile) => profile.name.toLowerCase() === normalized.toLowerCase()
  );
  return byName?.code ?? DEFAULT_COUNTRY_CODE;
}

export function defaultCurrency(countryCode?: string | null): string {
  return getCountryProfile(countryCode).defaultCurrency;
}

export function currencyLabel(currency: string, countryCode?: string | null): string {
  const profile = getCountryProfile(countryCode);
  return profile.currencies.find((item) => item.code === currency)?.name ?? currency;
}

export function localeForCurrency(currency: string): string {
  const match = COUNTRY_PROFILES.find(
    (profile) =>
      profile.defaultCurrency === currency ||
      profile.currencies.some((item) => item.code === currency)
  );
  return match?.locale ?? 'en';
}
