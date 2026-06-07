import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { redactPdf } from './redact';

async function makePdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 700;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 12, font });
    y -= 20;
  }
  return doc.save();
}

describe('redactPdf', () => {
  it('masks SSN, EIN, and account/routing numbers', async () => {
    const pdf = await makePdf([
      'Name: Jane Q Public',
      'SSN: 123-45-6789',
      'EIN: 12-3456789',
      'Account: 123456789012',
      'Wages: 84,000.00',
    ]);
    const { bytes, count } = await redactPdf(pdf);
    expect(count).toBeGreaterThanOrEqual(3); // SSN + EIN + account number
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('redacts nothing when there is no sensitive data', async () => {
    const pdf = await makePdf(['Hello world', 'Wages: 84,000.00', 'Total tax: 1,234']);
    const { count } = await redactPdf(pdf);
    expect(count).toBe(0);
  });
});
