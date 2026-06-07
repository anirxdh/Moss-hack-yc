import { z } from 'zod';

export type FilingStatus =
  | 'single'
  | 'married_joint'
  | 'married_separate'
  | 'head_of_household';

// Raw, transcribed-only values. The model fills these; it never computes.
const Money = z.number().nullable();

export const ExtractedDoc = z.object({
  formType: z.enum([
    'W-2',
    '1099-INT',
    '1099-DIV',
    '1099-B',
    '1099-R',
    '1099-G',
    'SSA-1099',
    '1040-prior',
    'unknown',
  ]),
  sourceLabel: z.string().nullable(), // employer / payer name if visible
  wages: Money, // W-2 box 1
  fedWithholding: Money, // W-2 box 2, or 1099 federal income tax withheld
  interestIncome: Money, // 1099-INT box 1
  ordinaryDividends: Money, // 1099-DIV box 1a
  qualifiedDividends: Money, // 1099-DIV box 1b
  capitalGain: Money, // 1099-B realized gain/(loss)
  otherIncome: Money,
  notes: z.string().nullable(),
});
export type ExtractedDoc = z.infer<typeof ExtractedDoc>;

export const ExtractionSchema = z.object({
  documents: z.array(ExtractedDoc),
  taxpayerName: z.string().nullable(),
  filingStatusGuess: z
    .enum(['single', 'married_joint', 'married_separate', 'head_of_household'])
    .nullable(),
});
export type ExtractionResult = z.infer<typeof ExtractionSchema>;

// Aggregated, normalized inputs to the tax computation.
export interface TaxInputs {
  filingStatus: FilingStatus;
  taxpayerName: string | null;
  wages: number;
  fedWithholding: number;
  taxableInterest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  capitalGain: number;
  otherIncome: number;
}

export type RefundOrOwe =
  | { type: 'refund'; amount: number }
  | { type: 'owe'; amount: number }
  | { type: 'even'; amount: 0 };

// Computed 1040 line items (tax year 2025).
export interface Form1040 {
  taxYear: 2025;
  filingStatus: FilingStatus;
  taxpayerName: string | null;
  line1a: number; // wages
  line2b: number; // taxable interest
  line3a: number; // qualified dividends
  line3b: number; // ordinary dividends
  line7: number; // capital gain/(loss)
  line9: number; // total income
  line11: number; // AGI
  line12: number; // standard deduction
  line15: number; // taxable income
  line16: number; // tax
  line24: number; // total tax
  line25d: number; // total withholding
  line33: number; // total payments
  line34: number; // overpayment (refund)
  line37: number; // amount you owe
  refundOrOwe: RefundOrOwe;
}
