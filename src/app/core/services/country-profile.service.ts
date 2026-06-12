import { Injectable, inject } from '@angular/core';
import {
  COUNTRY_PROFILES,
  CountryProfile,
  CurrencyOption,
  PaymentMethodOption,
  defaultCurrency,
  getCountryProfile,
  resolveCountryCode,
} from '../config/country-profiles.config';
import { formatCurrency } from '../utils/firestore.utils';
import { detectCountryCode } from '../utils/country-detect.utils';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CountryProfileService {
  private auth = inject(AuthService);

  readonly countries = COUNTRY_PROFILES;

  detectCountryCode(): Promise<string | null> {
    return detectCountryCode();
  }

  getProfile(countryCode?: string | null): CountryProfile {
    return getCountryProfile(countryCode);
  }

  resolveCountryCode(value?: string | null): string {
    return resolveCountryCode(value);
  }

  defaultCurrency(countryCode?: string | null): string {
    return defaultCurrency(countryCode);
  }

  currencyForUser(): string {
    return this.defaultCurrency(this.auth.currentUser()?.countryCode);
  }

  paymentMethodsForCountry(countryCode?: string | null): PaymentMethodOption[] {
    return getCountryProfile(countryCode).paymentMethods;
  }

  paymentMethodsForUser(): PaymentMethodOption[] {
    return this.paymentMethodsForCountry(this.auth.currentUser()?.countryCode);
  }

  currenciesForCountry(countryCode?: string | null): CurrencyOption[] {
    return getCountryProfile(countryCode).currencies;
  }

  formatMoney(amount: number | null | undefined, currency?: string, countryCode?: string | null): string {
    if (amount == null) return '—';
    const resolvedCurrency = currency ?? this.defaultCurrency(countryCode);
    const locale = getCountryProfile(countryCode).locale;
    return formatCurrency(amount, resolvedCurrency, locale);
  }

  paymentMethodsLabel(countryCode?: string | null): string {
    const labels = this.paymentMethodsForCountry(countryCode)
      .slice(0, 3)
      .map((method) => method.label);
    return `${labels.join(', ')} & more`;
  }
}
