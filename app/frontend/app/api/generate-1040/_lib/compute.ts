import type {
  ExtractedDoc,
  ExtractionResult,
  FilingStatus,
  Form1040,
  RefundOrOwe,
  TaxInputs,
} from './schema';

// 2025 standard deduction (Rev. Proc. 2024-40).
const STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single: 15000,
  married_separate: 15000,
  married_joint: 30000,
  head_of_household: 22500,
};

export function standardDeduction(status: FilingStatus): number {
  return STANDARD_DEDUCTION_2025[status];
}

// 2025 ordinary-income brackets: [upperBound, marginalRate].
type Bracket = [number, number];
const BRACKETS_2025: Record<FilingStatus, Bracket[]> = {
  single: [
    [11925, 0.1],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [626350, 0.35],
    [Infinity, 0.37],
  ],
  married_separate: [
    [11925, 0.1],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [375800, 0.35],
    [Infinity, 0.37],
  ],
  married_joint: [
    [23850, 0.1],
    [96950, 0.12],
    [206700, 0.22],
    [394600, 0.24],
    [501050, 0.32],
    [751600, 0.35],
    [Infinity, 0.37],
  ],
  head_of_household: [
    [17000, 0.1],
    [64850, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [626350, 0.35],
    [Infinity, 0.37],
  ],
};

export function taxFromBrackets(taxable: number, status: FilingStatus): number {
  if (taxable <= 0) return 0;
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of BRACKETS_2025[status]) {
    if (taxable > upper) {
      tax += (upper - lower) * rate;
      lower = upper;
    } else {
      tax += (taxable - lower) * rate;
      break;
    }
  }
  return Math.round(tax);
}

const num = (v: number | null | undefined): number =>
  typeof v === 'number' && isFinite(v) ? v : 0;
const sum = (docs: ExtractedDoc[], pick: (d: ExtractedDoc) => number | null): number =>
  docs.reduce((acc, d) => acc + num(pick(d)), 0);

export function aggregate(
  docs: ExtractedDoc[],
  meta: Pick<ExtractionResult, 'taxpayerName' | 'filingStatusGuess'>
): TaxInputs {
  const usable = docs.filter((d) => d.formType !== 'unknown');
  return {
    filingStatus: meta.filingStatusGuess ?? 'single',
    taxpayerName: meta.taxpayerName,
    wages: sum(usable, (d) => d.wages),
    fedWithholding: sum(usable, (d) => d.fedWithholding),
    taxableInterest: sum(usable, (d) => d.interestIncome),
    ordinaryDividends: sum(usable, (d) => d.ordinaryDividends),
    qualifiedDividends: sum(usable, (d) => d.qualifiedDividends),
    capitalGain: sum(usable, (d) => d.capitalGain),
    otherIncome: sum(usable, (d) => d.otherIncome),
  };
}

export function computeForm1040(inp: TaxInputs): Form1040 {
  const line1a = Math.round(inp.wages);
  const line2b = Math.round(inp.taxableInterest);
  const line3a = Math.round(inp.qualifiedDividends);
  const line3b = Math.round(inp.ordinaryDividends);
  const line7 = Math.round(inp.capitalGain);
  const line9 = line1a + line2b + line3b + line7 + Math.round(inp.otherIncome);
  const line11 = line9; // no adjustments in v1
  const line12 = standardDeduction(inp.filingStatus);
  const line15 = Math.max(0, line11 - line12);
  const line16 = taxFromBrackets(line15, inp.filingStatus);
  const line24 = line16; // no other taxes in v1
  const line25d = Math.round(inp.fedWithholding);
  const line33 = line25d; // no other payments in v1

  let line34 = 0;
  let line37 = 0;
  let refundOrOwe: RefundOrOwe = { type: 'even', amount: 0 };
  if (line33 > line24) {
    line34 = line33 - line24;
    refundOrOwe = { type: 'refund', amount: line34 };
  } else if (line24 > line33) {
    line37 = line24 - line33;
    refundOrOwe = { type: 'owe', amount: line37 };
  }

  return {
    taxYear: 2025,
    filingStatus: inp.filingStatus,
    taxpayerName: inp.taxpayerName,
    line1a,
    line2b,
    line3a,
    line3b,
    line7,
    line9,
    line11,
    line12,
    line15,
    line16,
    line24,
    line25d,
    line33,
    line34,
    line37,
    refundOrOwe,
  };
}
