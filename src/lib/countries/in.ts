import { COMMON_TYPES as T } from "./common";
import type { CountryModule } from "./types";

export const IN: CountryModule = {
  code: "IN",
  name: "India",
  currency: "INR",
  locale: "en-IN",
  accountTypes: [
    T.savings,
    T.brokerage,
    T.mutual_funds,
    T.fixed_deposit,
    { id: "ppf", label: "PPF" },
    { id: "epf", label: "EPF" },
    { id: "nps", label: "NPS" },
    T.real_estate,
    T.crypto,
    T.other,
    T.loan,
    T.credit_card,
  ],
  institutions: [
    { name: "SBI", match: ["STATE BANK OF INDIA"] },
    { name: "HDFC Bank", match: ["HDFC BANK"] },
    { name: "ICICI Bank", match: ["ICICI BANK"] },
    { name: "Bank of Baroda", match: ["BANK OF BARODA"] },
    { name: "Axis Bank", match: ["AXIS BANK"] },
    { name: "Kotak Mahindra Bank", match: ["KOTAK MAHINDRA BANK"] },
    { name: "Groww", match: ["GROWW", "NEXTBILLION"] },
    { name: "Zerodha", match: ["ZERODHA"] },
    { name: "Angel One", match: ["ANGEL ONE", "ANGEL BROKING"] },
    { name: "Upstox", match: ["UPSTOX", "RKSV"] },
    { name: "ICICI Direct", match: ["ICICI SECURITIES"] },
    { name: "HDFC Securities", match: ["HDFC SECURITIES"] },
    { name: "Kotak Securities", match: ["KOTAK SECURITIES"] },
    { name: "Kuvera", match: ["KUVERA"] },
  ],
  inflationIndex: "India CPI (Combined)",
  importers: [
    {
      id: "cas",
      label: "CDSL / NSDL CAS",
      description:
        "Upload your monthly Consolidated Account Statement PDF to update demat and mutual fund values.",
      href: "/import/cas",
    },
  ],
};
