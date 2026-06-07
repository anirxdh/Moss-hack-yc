import { PDFDocument, rgb } from 'pdf-lib';
import { getDocumentProxy } from 'unpdf';

// Visual PII redaction for the on-screen PDF (display only — the text sent to
// Moss is intentionally left intact). We locate sensitive tokens by their text
// position (via pdf.js) and paint an opaque grey rectangle over each one with
// pdf-lib, so SSNs / account & routing numbers / EINs never appear in the demo.
//
// Caveat: this covers tokens the way the PDF emits them (the common case — each
// number is one text run). It is a demo-grade visual mask, not a forensic
// redaction: the underlying text layer still exists in the bytes. Good enough
// for "don't show SSNs on screen"; do not treat it as legally-scrubbed output.

// SSN (123-45-6789 / 123 45 6789), EIN (12-3456789), and bare 8–17 digit runs
// (no-dash SSN, routing, account numbers). Amounts are comma/decimal-formatted,
// so they don't trip the bare-digit rule.
const PII_PATTERNS: RegExp[] = [
  /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/, // SSN
  /\b\d{2}-\d{7}\b/, // EIN
  /\b\d{8,17}\b/, // bare digit run: SSN-no-dash / routing / account
];

function isPii(s: string): boolean {
  return PII_PATTERNS.some((re) => re.test(s));
}

interface TextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface RedactResult {
  bytes: Uint8Array;
  count: number;
}

/**
 * Return a copy of `pdfBytes` with grey boxes painted over SSN / account /
 * routing / EIN tokens. `count` is how many tokens were masked.
 */
export async function redactPdf(pdfBytes: Uint8Array): Promise<RedactResult> {
  const proxy = await getDocumentProxy(new Uint8Array(pdfBytes));
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();

  let count = 0;
  for (let p = 1; p <= proxy.numPages; p++) {
    const out = pages[p - 1];
    if (!out) continue;
    const content = await proxy.getPage(p).then((pg) => pg.getTextContent());
    for (const raw of content.items as TextItem[]) {
      const str = raw.str;
      if (!str || !raw.transform || !isPii(str)) continue;
      const x = raw.transform[4];
      const y = raw.transform[5];
      const h = raw.height && raw.height > 1 ? raw.height : 10;
      const w = raw.width && raw.width > 1 ? raw.width : str.length * h * 0.55;
      // Slight margin so descenders/edges are fully covered.
      out.drawRectangle({
        x: x - 1,
        y: y - h * 0.3,
        width: w + 2,
        height: h * 1.5,
        color: rgb(0.42, 0.42, 0.42),
      });
      count++;
    }
  }

  return { bytes: await doc.save(), count };
}
