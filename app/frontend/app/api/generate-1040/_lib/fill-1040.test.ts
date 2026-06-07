import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { fillForm1040 } from './fill-1040';
import type { Form1040 } from './schema';

const sample: Form1040 = {
  taxYear: 2025,
  filingStatus: 'single',
  taxpayerName: 'Jane Q Public',
  line1a: 50000,
  line2b: 120,
  line3a: 0,
  line3b: 300,
  line7: 0,
  line9: 50420,
  line11: 50420,
  line12: 15000,
  line15: 35420,
  line16: 4012,
  line24: 4012,
  line25d: 4000,
  line33: 4000,
  line34: 0,
  line37: 12,
  refundOrOwe: { type: 'owe', amount: 12 },
};

describe('fillForm1040', () => {
  it('produces a PDF and writes the mapped IRS fields', async () => {
    const bytes = await fillForm1040(sample);
    expect(bytes.length).toBeGreaterThan(1000);

    const form = (await PDFDocument.load(bytes)).getForm();
    const get = (n: string) => form.getTextField(n).getText();
    expect(get('topmostSubform[0].Page1[0].f1_47[0]')).toBe('50,000'); // 1a
    expect(get('topmostSubform[0].Page1[0].f1_59[0]')).toBe('120'); // 2b
    expect(get('topmostSubform[0].Page1[0].f1_73[0]')).toBe('50,420'); // 9
    expect(get('topmostSubform[0].Page2[0].f2_02[0]')).toBe('15,000'); // 12
    expect(get('topmostSubform[0].Page2[0].f2_06[0]')).toBe('35,420'); // 15
    expect(get('topmostSubform[0].Page2[0].f2_16[0]')).toBe('4,012'); // 24
    expect(get('topmostSubform[0].Page2[0].f2_35[0]')).toBe('12'); // 37 owe
  });
});
