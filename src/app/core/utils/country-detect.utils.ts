import { COUNTRY_PROFILES, DEFAULT_COUNTRY_CODE, getCountryProfile } from '../config/country-profiles.config';

const TIMEZONE_COUNTRY: Record<string, string> = {
  'Africa/Banjul': 'GM',
  'Africa/Dakar': 'SN',
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Nairobi': 'KE',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
  'Europe/Paris': 'FR',
};

function isSupportedCountry(code: string): boolean {
  return COUNTRY_PROFILES.some((profile) => profile.code === code);
}

function countryFromLocale(): string | null {
  const locales = [navigator.language, ...(navigator.languages ?? [])];

  for (const locale of locales) {
    const parts = locale.split('-');
    if (parts.length < 2) continue;

    const code = parts[parts.length - 1].toUpperCase();
    if (isSupportedCountry(code)) {
      return code;
    }
  }

  return null;
}

function countryFromTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const code = TIMEZONE_COUNTRY[timezone];
    return code && isSupportedCountry(code) ? code : null;
  } catch {
    return null;
  }
}

async function countryFromIpLookup(): Promise<string | null> {
  try {
    const response = await fetch('https://ipapi.co/country_code/', {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;

    const code = (await response.text()).trim().toUpperCase();
    return isSupportedCountry(code) ? code : null;
  } catch {
    return null;
  }
}

/** Best-effort country detection for onboarding; falls back to manual selection. */
export async function detectCountryCode(): Promise<string | null> {
  return (
    countryFromLocale() ??
    countryFromTimezone() ??
    (await countryFromIpLookup())
  );
}

export function phonePlaceholder(countryCode?: string | null): string {
  return `${getCountryProfile(countryCode).dialCode} XXX XXXX`;
}

export function fallbackCountryCode(): string {
  return DEFAULT_COUNTRY_CODE;
}
