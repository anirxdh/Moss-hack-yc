import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, type PDFFont, StandardFonts, rgb } from 'pdf-lib';
import type { FilingStatus, Form1040 } from './schema';

const TEMPLATE = join(process.cwd(), 'app/api/generate-1040/f1040-2025.pdf');

const P1 = 'topmostSubform[0].Page1[0].';
const P2 = 'topmostSubform[0].Page2[0].';

// AcroForm amount field names, verified against the 2025 IRS f1040 by geometry
// (see _lib/dump-geometry.mjs). Each entry: [fieldName, valueFromForm1040].
function amountFields(f: Form1040): [string, number][] {
  return [
    [`${P1}f1_47[0]`, f.line1a], // 1a wages
    [`${P1}f1_57[0]`, f.line1a], // 1z total wages (= 1a; no 1b–1h in v1)
    [`${P1}f1_59[0]`, f.line2b], // 2b taxable interest
    [`${P1}f1_61[0]`, f.line3b], // 3b ordinary dividends
    [`${P1}f1_70[0]`, f.line7], // 7 capital gain/(loss)
    [`${P1}f1_73[0]`, f.line9], // 9 total income
    [`${P1}f1_75[0]`, f.line11], // 11a AGI
    [`${P2}f2_01[0]`, f.line11], // 11b AGI (page 2)
    [`${P2}f2_02[0]`, f.line12], // 12 standard deduction
    [`${P2}f2_05[0]`, f.line12], // 14 total deductions (= 12; QBI/other = 0)
    [`${P2}f2_06[0]`, f.line15], // 15 taxable income
    [`${P2}f2_08[0]`, f.line16], // 16 tax
    [`${P2}f2_10[0]`, f.line16], // 18 (= 16; line 17 = 0)
    [`${P2}f2_14[0]`, f.line16], // 22 (= 16; lines 19–21 = 0)
    [`${P2}f2_16[0]`, f.line24], // 24 total tax
    [`${P2}f2_20[0]`, f.line25d], // 25d total withholding (25a–25c sub-lines omitted; 25d drives the math)
    [`${P2}f2_29[0]`, f.line33], // 33 total payments
    [`${P2}f2_30[0]`, f.line34], // 34 overpayment
    [`${P2}f2_31[0]`, f.line34], // 35a refund (= 34)
    [`${P2}f2_35[0]`, f.line37], // 37 amount you owe
  ];
}

// Filing-status checkbox is a shared-widget radio (checking c1_8[0] would tick
// both Single and Head-of-household), so we stamp a precise overlay "X" on
// page 1 at the checkbox coordinates instead. [x, y] of the box's lower-left.
const FILING_STATUS_XY: Record<FilingStatus, [number, number]> = {
  single: [98, 578],
  married_joint: [98, 566],
  married_separate: [98, 554],
  head_of_household: [350, 578],
};

// 0 -> blank (IRS norm). Negatives (e.g. a capital loss on line 7, or a
// negative total income) render in parentheses, the IRS convention — never blank.
const money = (n: number): string =>
  n === 0 ? '' : n < 0 ? `(${Math.abs(n).toLocaleString('en-US')})` : n.toLocaleString('en-US');

export async function fillForm1040(form1040: Form1040): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(await readFile(TEMPLATE));
  const form = pdfDoc.getForm();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const setText = (name: string, value: string) => {
    if (!value) return;
    try {
      const tf = form.getTextField(name);
      tf.setText(value);
      tf.updateAppearances(helv);
    } catch {
      /* field-name mismatch — overlay banner still reports the result */
    }
  };

  // Taxpayer name (cosmetic): first token(s) -> first-name box, last -> last-name box.
  if (form1040.taxpayerName) {
    const parts = form1040.taxpayerName.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.pop()! : '';
    setText(`${P1}f1_11[0]`, parts.join(' '));
    if (last) setText(`${P1}f1_12[0]`, last);
  }

  for (const [name, value] of amountFields(form1040)) {
    setText(name, money(value));
  }

  // Filing-status overlay "X".
  const page1 = pdfDoc.getPages()[0];
  const [fx, fy] = FILING_STATUS_XY[form1040.filingStatus];
  page1.drawText('X', { x: fx + 2, y: fy + 1.5, size: 9, font: helv, color: rgb(0, 0, 0) });

  drawDraftBanner(page1, helv, form1040);

  return await pdfDoc.save();
}

function drawDraftBanner(
  page: ReturnType<PDFDocument['getPages']>[number],
  font: PDFFont,
  f: Form1040
): void {
  const r = f.refundOrOwe;
  const banner =
    r.type === 'refund'
      ? `Refund: $${r.amount.toLocaleString('en-US')}`
      : r.type === 'owe'
        ? `Amount owed: $${r.amount.toLocaleString('en-US')}`
        : 'Balance: $0';
  page.drawText(`AI CPA draft estimate (tax year ${f.taxYear}) — ${banner}`, {
    x: 36,
    y: 18,
    size: 8,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
}
