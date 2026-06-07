import { describe, it, expect } from 'vitest';
import { standardDeduction, taxFromBrackets, aggregate, computeForm1040 } from './compute';
import type { ExtractedDoc, TaxInputs } from './schema';

const blankDoc = (over: Partial<ExtractedDoc>): ExtractedDoc => ({
  formType: 'unknown',
  sourceLabel: null,
  wages: null,
  fedWithholding: null,
  interestIncome: null,
  ordinaryDividends: null,
  qualifiedDividends: null,
  capitalGain: null,
  otherIncome: null,
  notes: null,
  ...over,
});

const inputs = (over: Partial<TaxInputs>): TaxInputs => ({
  filingStatus: 'single',
  taxpayerName: null,
  wages: 0,
  fedWithholding: 0,
  taxableInterest: 0,
  ordinaryDividends: 0,
  qualifiedDividends: 0,
  capitalGain: 0,
  otherIncome: 0,
  ...over,
});

describe('standardDeduction (2025)', () => {
  it('single = 15000', () => expect(standardDeduction('single')).toBe(15000));
  it('married_joint = 30000', () => expect(standardDeduction('married_joint')).toBe(30000));
  it('head_of_household = 22500', () => expect(standardDeduction('head_of_household')).toBe(22500));
  it('married_separate = 15000', () => expect(standardDeduction('married_separate')).toBe(15000));
});

describe('taxFromBrackets (2025, single)', () => {
  it('within 10% bracket', () => expect(taxFromBrackets(10000, 'single')).toBe(1000));
  it('spans 10% + 12%', () => expect(taxFromBrackets(20000, 'single')).toBe(2162)); // 1192.5 + .12*8075 = 2161.5 -> round
  it('zero taxable income', () => expect(taxFromBrackets(0, 'single')).toBe(0));
});

describe('aggregate', () => {
  it('sums wages across multiple W-2s and respects guessed status', () => {
    const got = aggregate(
      [
        blankDoc({ formType: 'W-2', wages: 30000, fedWithholding: 2000 }),
        blankDoc({ formType: 'W-2', wages: 20000, fedWithholding: 1500 }),
      ],
      { taxpayerName: 'Jane Q', filingStatusGuess: 'single' },
    );
    expect(got.wages).toBe(50000);
    expect(got.fedWithholding).toBe(3500);
    expect(got.filingStatus).toBe('single');
  });
  it('defaults filing status to single when no guess', () => {
    expect(aggregate([], { taxpayerName: null, filingStatusGuess: null }).filingStatus).toBe('single');
  });
  it('ignores unknown-form documents', () => {
    const got = aggregate([blankDoc({ formType: 'unknown', wages: 99999 })], {
      taxpayerName: null,
      filingStatusGuess: null,
    });
    expect(got.wages).toBe(0);
  });
});

describe('computeForm1040', () => {
  it('W-2 only -> refund', () => {
    const f = computeForm1040(inputs({ wages: 50000, fedWithholding: 4000 }));
    expect(f.line9).toBe(50000);
    expect(f.line11).toBe(50000);
    expect(f.line12).toBe(15000);
    expect(f.line15).toBe(35000);
    expect(f.line16).toBe(3962); // 1192.5 + .12*23075 = 3961.5 -> round
    expect(f.line25d).toBe(4000);
    expect(f.refundOrOwe).toEqual({ type: 'refund', amount: 38 });
  });
  it('higher income -> owe', () => {
    const f = computeForm1040(inputs({ wages: 90000, fedWithholding: 5000 }));
    expect(f.line15).toBe(75000);
    expect(f.line16).toBe(11414); // 1192.5 + .12*36550 + .22*26525
    expect(f.refundOrOwe).toEqual({ type: 'owe', amount: 6414 });
  });
  it('zero income -> even', () => {
    const f = computeForm1040(inputs({}));
    expect(f.line15).toBe(0);
    expect(f.line16).toBe(0);
    expect(f.refundOrOwe).toEqual({ type: 'even', amount: 0 });
  });
});
