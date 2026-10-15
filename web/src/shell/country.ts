import { JAPAC_COUNTRIES, countriesForZone } from '../../../shared/timezones.ts';

const COUNTRY_KEY = 'country';

export interface DetectedCountry {
  code: string | null;
  candidates: string[];
}

// Reads the device's time zone and maps it to the JAPAC countries that share it.
// `code` is set only when the zone names exactly one country; otherwise the picker decides.
export function detectCountry(): DetectedCountry {
  let zone: string | undefined;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    zone = undefined;
  }
  const candidates = zone ? countriesForZone(zone) : [];
  return { code: candidates.length === 1 ? candidates[0] : null, candidates };
}

// Storage can be blocked (private mode). Then the choice lasts for this visit only.
export function readCountryOverride(): string | null {
  try {
    return localStorage.getItem(COUNTRY_KEY);
  } catch {
    return null;
  }
}

export function storeCountryOverride(code: string): void {
  try {
    localStorage.setItem(COUNTRY_KEY, code);
  } catch {
    // Nothing to do: the state in memory still holds the choice.
  }
}

// Manual override wins over the time zone.
export const initialCountry = (): string | null => readCountryOverride() ?? detectCountry().code;

export const countryName = (code: string | null): string =>
  JAPAC_COUNTRIES.find((country) => country.code === code)?.name ?? 'not chosen yet';
