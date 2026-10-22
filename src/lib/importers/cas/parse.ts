import { matchInstitution } from "../../countries";
import { parseAmount } from "../../money";

/**
 * Parser for the summary page of an Indian Consolidated Account Statement (CDSL or NSDL e-CAS).
 *
 * It reads only the "summary of value of holdings" rows: one per demat account plus one for
 * mutual fund folios held with the RTAs. Statement layouts drift, so results are always shown
 * to the user for review before anything is saved, and a mismatch with the statement's own
 * total is reported as a warning.
 */
export interface CasEntry {
  kind: "demat" | "mutual_funds";
  depository?: "CDSL" | "NSDL";
  /** Depository participant name as printed, or "Mutual Fund Folios". */
  dpName: string;
  /** Known institution matched from dpName, if any. */
  institution?: string;
  dpId?: string;
  /** Last 4 characters of the client / BO id. The full id is not kept. */
  refTail: string;
  holdingsCount?: number;
  value: number;
}

export interface CasStatement {
  statementDate: string | null;
  totalValue: number | null;
  entries: CasEntry[];
  warnings: string[];
}

const AMOUNT = /(?:\d+,)*\d+\.\d{2}(?!\d)/g;
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function toIsoDate(text: string): string | null {
  const m = text.match(/(\d{1,2})[-/ ]([A-Za-z]{3}|\d{1,2})[-/ ](\d{4})/);
  if (!m) return null;
  const month = /\d/.test(m[2]) ? m[2].padStart(2, "0") : MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

const lastAmount = (line: string): number | null => {
  const all = line.match(AMOUNT);
  return all ? parseAmount(all[all.length - 1]) : null;
};

function findStatementDate(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/period\s+from\s+.+?\s+to\s+(\d{1,2}[-/ ](?:[A-Za-z]{3}|\d{1,2})[-/ ]\d{4})/i);
    if (m) return toIsoDate(m[1]);
  }
  for (const l of lines) {
    const m = l.match(/as\s+on\s+(\d{1,2}[-/ ](?:[A-Za-z]{3}|\d{1,2})[-/ ]\d{4})/i);
    if (m) return toIsoDate(m[1]);
  }
  return null;
}

export function parseCas(lines: string[]): CasStatement {
  const warnings: string[] = [];
  const statementDate = findStatementDate(lines);

  let totalValue: number | null = null;
  const totalIdx = lines.findIndex((l) => /consolidated\s+portfolio\s+value/i.test(l));
  if (totalIdx >= 0) totalValue = lastAmount(lines[totalIdx]) ?? lastAmount(lines[totalIdx + 1] ?? "");

  // Prefer the summary table; fall back to the whole document.
  const start = lines.findIndex((l) => /summary\s+of\s+value\s+of\s+holdings/i.test(l));
  const scope = start >= 0 ? lines.slice(start) : lines;
  const end = scope.findIndex((l, i) => i > 0 && /^\s*(grand\s+)?total\b/i.test(l));
  const summary = end >= 0 ? scope.slice(0, end) : scope;

  const entries: CasEntry[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < summary.length; i++) {
    const line = summary[i];
    const demat = line.match(/\b(CDSL|NSDL)\s+Demat\s+Account\b\s*(.*)$/i);
    if (demat) {
      // An entry's id line(s) follow it until the next entry starts.
      const window = [line];
      for (let j = i + 1; j < Math.min(i + 3, summary.length); j++) {
        if (/Demat\s+Account|Mutual\s+Fund\s+Folios/i.test(summary[j])) break;
        window.push(summary[j]);
      }
      const joined = window.join(" ");
      const value = lastAmount(line) ?? window.map(lastAmount).find((v) => v !== null) ?? null;
      const dpId = joined.match(/DP\s*I[dD]\s*:?\s*([A-Z0-9]+)/)?.[1];
      const clientId = joined.match(/Client\s*I[dD]\s*:?\s*([A-Z0-9]+)/i)?.[1];
      // Name = text after "Demat Account" up to the count/amount columns or the id labels.
      const dpName = demat[2]
        .replace(AMOUNT, "")
        .replace(/\bDP\s*I[dD].*$/i, "")
        .replace(/\s+\d+\s*$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const count = demat[2].match(/\s(\d{1,4})\s+(?:\d+,)*\d+\.\d{2}\s*$/)?.[1];
      if (value === null) {
        warnings.push(`Couldn't read a value for ${dpName || "a demat account"}.`);
        continue;
      }
      const refTail = (clientId ?? dpId ?? dpName).slice(-4);
      const key = `${dpId}:${clientId}:${dpName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        kind: "demat",
        depository: demat[1].toUpperCase() as "CDSL" | "NSDL",
        dpName,
        institution: matchInstitution("IN", dpName),
        dpId,
        refTail,
        holdingsCount: count ? Number(count) : undefined,
        value,
      });
      continue;
    }
    if (/Mutual\s+Fund\s+Folios/i.test(line) && !seen.has("mf")) {
      const value = lastAmount(line);
      if (value === null) continue;
      seen.add("mf");
      const folios = line.match(/(\d+)\s+Folios/i)?.[1];
      entries.push({
        kind: "mutual_funds",
        dpName: "Mutual Fund Folios",
        refTail: "MF",
        holdingsCount: folios ? Number(folios) : undefined,
        value,
      });
    }
  }

  if (!entries.length) warnings.push("No demat or mutual fund rows were found. Is this a CDSL or NSDL CAS?");
  if (totalValue !== null && entries.length) {
    const sum = entries.reduce((s, e) => s + e.value, 0);
    if (Math.abs(sum - totalValue) > 1) {
      warnings.push(
        `Rows add up to ${sum.toFixed(2)} but the statement total is ${totalValue.toFixed(2)}. Check the values below.`,
      );
    }
  }
  if (!statementDate) warnings.push("Couldn't find the statement date; please set it below.");

  return { statementDate, totalValue, entries, warnings };
}
