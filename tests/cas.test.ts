import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfLines, PdfPasswordError } from "@/lib/importers/cas/extract";
import { parseCas, toIsoDate } from "@/lib/importers/cas/parse";

// Synthetic statement made by scripts/make-cas-fixture.py. No real data.
const fixture = new Uint8Array(readFileSync(path.join(__dirname, "fixtures/sample-cas.pdf")));
const PASSWORD = "ABCDE1234F";

describe("CAS PDF import", () => {
  it("rejects a missing or wrong password", async () => {
    await expect(extractPdfLines(fixture.slice())).rejects.toMatchObject({ reason: "needed" });
    await expect(extractPdfLines(fixture.slice(), "WRONG")).rejects.toBeInstanceOf(PdfPasswordError);
    await expect(extractPdfLines(fixture.slice(), "WRONG")).rejects.toMatchObject({ reason: "incorrect" });
  });

  it("reads the summary rows of an AES-256 protected statement", async () => {
    const lines = await extractPdfLines(fixture.slice(), PASSWORD);
    const cas = parseCas(lines);
    expect(cas.statementDate).toBe("2026-08-31");
    expect(cas.totalValue).toBe(1235326.18);
    expect(cas.warnings).toEqual([]);
    expect(cas.entries).toEqual([
      expect.objectContaining({ kind: "demat", depository: "CDSL", institution: "Groww", dpId: "12088700", refTail: "4321", holdingsCount: 12, value: 425310.5 }),
      expect.objectContaining({ kind: "demat", institution: "Angel One", refTail: "9876", value: 1250 }),
      expect.objectContaining({ kind: "demat", depository: "NSDL", institution: "Zerodha", dpId: "IN303575", refTail: "5555", value: 98765.43 }),
      expect.objectContaining({ kind: "mutual_funds", refTail: "MF", holdingsCount: 8, value: 710000.25 }),
    ]);
  });
});

describe("parseCas", () => {
  it("warns when rows don't add up to the statement total", () => {
    const cas = parseCas([
      "Statement for the period from 01-Sep-2026 to 30-Sep-2026",
      "YOUR CONSOLIDATED PORTFOLIO VALUE  ` 2,000.00",
      "Summary of value of holdings",
      "CDSL Demat Account  SOME UNKNOWN BROKER LTD  3  1,500.00",
      "DP Id: 11111111 Client Id: 22223333",
      "Total  2,000.00",
    ]);
    expect(cas.statementDate).toBe("2026-09-30");
    expect(cas.entries).toHaveLength(1);
    expect(cas.entries[0]).toMatchObject({ dpName: "SOME UNKNOWN BROKER LTD", institution: undefined, refTail: "3333" });
    expect(cas.warnings[0]).toMatch(/add up/);
  });

  it("explains when nothing is recognised", () => {
    expect(parseCas(["hello"]).warnings[0]).toMatch(/No demat/);
  });

  it("normalises dates", () => {
    expect(toIsoDate("5-Mar-2026")).toBe("2026-03-05");
    expect(toIsoDate("31/12/2025")).toBe("2025-12-31");
    expect(toIsoDate("nope")).toBeNull();
  });
});
