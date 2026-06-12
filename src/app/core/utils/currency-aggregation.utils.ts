import { defaultCurrency, resolveCountryCode } from '../config/country-profiles.config';
import { Property } from '../models/property.model';

export interface ListCurrencyContext {
  currency: string;
  mixedCurrencies: boolean;
  currencies: string[];
}

export function resolveOwnerListCurrency(
  properties: Property[],
  userCountryCode?: string | null
): ListCurrencyContext {
  const currencies = [...new Set(properties.map((property) => property.currency).filter(Boolean))];
  const fallback = defaultCurrency(userCountryCode);

  if (currencies.length === 0) {
    return { currency: fallback, mixedCurrencies: false, currencies: [fallback] };
  }

  if (currencies.length === 1) {
    return { currency: currencies[0]!, mixedCurrencies: false, currencies };
  }

  return { currency: currencies[0]!, mixedCurrencies: true, currencies };
}

export function propertyCountryCode(property: Property): string {
  return property.countryCode ?? resolveCountryCode(property.country);
}
