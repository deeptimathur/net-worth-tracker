/**
 * A country plug-in. Adding a country means writing one of these and
 * registering it in ./index.ts; nothing else in the app is country-specific.
 */
export interface AccountType {
  id: string;
  label: string;
  /** Liabilities (loans, cards) are subtracted from net worth. */
  liability?: boolean;
}

export interface InstitutionAlias {
  /** Display name used in the app. */
  name: string;
  /** Upper-case substrings that identify it in statements, e.g. a DP name in a CAS. */
  match: string[];
}

export interface ImporterInfo {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface CountryModule {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** ISO 4217. */
  currency: string;
  /** Locale used to format this country's currency (e.g. en-IN for lakh grouping). */
  locale: string;
  accountTypes: AccountType[];
  /** Suggestions for the institution field, plus aliases importers use to name accounts. */
  institutions: InstitutionAlias[];
  /** Consumer inflation index used for "growth vs inflation" (later milestone). */
  inflationIndex: string;
  importers: ImporterInfo[];
}
