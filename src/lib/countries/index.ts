import { IN } from "./in";
import { US } from "./us";
import type { AccountType, CountryModule } from "./types";

export type { AccountType, CountryModule } from "./types";

/** Register new countries here. */
export const COUNTRIES: CountryModule[] = [US, IN];

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): CountryModule | undefined {
  return byCode.get(code);
}

export function getAccountType(country: string, typeId: string): AccountType | undefined {
  return getCountry(country)?.accountTypes.find((t) => t.id === typeId);
}

export function isLiability(country: string, typeId: string): boolean {
  return getAccountType(country, typeId)?.liability === true;
}

/** Every currency the app can hold, in registry order. */
export const SUPPORTED_CURRENCIES: string[] = [...new Set(COUNTRIES.map((c) => c.currency))];

/** Match free text (e.g. a CAS DP name) to a known institution of a country. */
export function matchInstitution(country: string, text: string): string | undefined {
  const upper = text.toUpperCase();
  return getCountry(country)?.institutions.find((i) => i.match.some((m) => upper.includes(m)))?.name;
}
