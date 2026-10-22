import "server-only";

export class PdfPasswordError extends Error {
  constructor(public readonly reason: "needed" | "incorrect") {
    super(reason === "needed" ? "This PDF needs a password." : "That password didn't open the PDF.");
  }
}

/**
 * Extract text lines from a (possibly password-protected) PDF, entirely in memory.
 * Neither the file nor the password is written anywhere.
 */
export async function extractPdfLines(data: Uint8Array, password?: string): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data,
    password,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if ((err as { name?: string }).name === "PasswordException") {
      // pdf.js: code 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      throw new PdfPasswordError((err as { code?: number }).code === 2 ? "incorrect" : "needed");
    }
    throw err;
  }
  try {
    const lines: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Group text runs into lines by their baseline, then order each line left to right.
      const rows: { y: number; parts: { x: number; w: number; s: string }[] }[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, , , , x, y] = item.transform as number[];
        let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
        if (!row) rows.push((row = { y, parts: [] }));
        row.parts.push({ x, w: item.width, s: item.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const row of rows) {
        row.parts.sort((a, b) => a.x - b.x);
        let line = "";
        let prevEnd = -Infinity;
        for (const part of row.parts) {
          // Keep wide gaps visible as double spaces so columns stay distinguishable.
          if (line) line += part.x - prevEnd > 12 ? "  " : " ";
          line += part.s.trim();
          prevEnd = part.x + part.w;
        }
        lines.push(line);
      }
      page.cleanup();
    }
    return lines;
  } finally {
    await task.destroy();
  }
}
