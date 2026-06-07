# Generate 1040 Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `POST /api/generate-1040` that bypasses on empty upload and, when PDFs are present, reads them with Qwen, computes a real 1040 (tax year 2025) deterministically, and fills the official IRS Form 1040 — then wire `/upload` → `/return` to use it.

**Architecture:** A Next.js (App Router) Node-runtime route holds all logic in colocated `_lib/` modules: `extract.ts` (unpdf text → Qwen `generateObject` structured JSON), `compute.ts` (pure TS 1040 math), `fill-1040.ts` (pdf-lib fills the vendored IRS template). The LLM only transcribes raw box values; TypeScript does the tax math; pdf-lib fills the real form. The frontend only POSTs files and renders the returned PDF + summary.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, `ai` v5 + `@ai-sdk/openai-compatible` (Qwen/DashScope, OpenAI-compatible), `unpdf` (PDF text), `pdf-lib` (AcroForm fill), `zod` (schema), `vitest` (unit tests for the pure compute module). pnpm.

**Working directory note:** the frontend app lives in `app/frontend/`. Commands below run from the repo root using `pnpm --dir app/frontend …`. Paths under "Files:" are relative to repo root.

---

### Task 1: Dependencies, test runner, and env

**Files:**
- Modify: `app/frontend/package.json`
- Modify: `app/frontend/.env.example`
- Create: `app/frontend/vitest.config.ts`

- [ ] **Step 1: Install runtime + dev dependencies**

Run (from repo root):
```bash
pnpm --dir app/frontend add @ai-sdk/openai-compatible unpdf pdf-lib zod
pnpm --dir app/frontend add -D vitest
```
Expected: `package.json` gains the four deps and `vitest` devDep; lockfile updates. (`ai` is already present.)

- [ ] **Step 2: Add a `test` script to `app/frontend/package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `app/frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Append Qwen vars to `app/frontend/.env.example`**

Add at the end of the file:
```
# ---------------------------------------------------------------------------
# Tax extraction LLM — Qwen via Alibaba DashScope (OpenAI-compatible).
# Used by POST /api/generate-1040 to read uploaded tax PDFs.
# ---------------------------------------------------------------------------
QWEN_API_KEY=
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

- [ ] **Step 5: Verify install**

Run: `pnpm --dir app/frontend exec vitest --version`
Expected: prints a vitest version (confirms dev dep resolves).

- [ ] **Step 6: Commit**

```bash
git add app/frontend/package.json app/frontend/pnpm-lock.yaml app/frontend/.env.example app/frontend/vitest.config.ts
git commit -m "build(frontend): add deps + vitest + Qwen env for 1040 endpoint"
```

---

### Task 2: Vendor the IRS Form 1040 template and discover its field names

The official IRS 1040 is a fillable AcroForm whose field names are opaque (e.g. `topmostSubform[0].Page1[0].f1_32[0]`). We vendor the PDF and discover the exact names so `fill-1040.ts` can map computed lines to fields.

**Files:**
- Create: `app/frontend/app/api/generate-1040/f1040-2025.pdf` (downloaded binary)
- Create: `app/frontend/app/api/generate-1040/_lib/dump-fields.mjs` (one-off discovery tool, kept in repo)
- Create: `app/frontend/app/api/generate-1040/_lib/field-names.txt` (captured output, for reference)

- [ ] **Step 1: Download the official template**

Run (from repo root):
```bash
curl -fL https://www.irs.gov/pub/irs-pdf/f1040.pdf -o app/frontend/app/api/generate-1040/f1040-2025.pdf
```
Expected: a ~150–400 KB PDF. Verify it opens and is the 2025 Form 1040 (top of page 1 reads "Form 1040 (2025)" or "2025"). If the IRS has not posted 2025 yet, use the latest available year and rename the constant accordingly in Task 6 (the form layout is stable year to year).

- [ ] **Step 2: Create the field-dump tool `_lib/dump-fields.mjs`**

```js
// One-off: lists every AcroForm field (type | name) and writes a "labeled"
// copy where each text field shows its own short name, so you can open it in
// a viewer and see exactly which f1_XX[0] maps to which 1040 line.
// Run from app/frontend:  node app/api/generate-1040/_lib/dump-fields.mjs
import { PDFDocument } from 'pdf-lib';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tpl = join(here, '..', 'f1040-2025.pdf');

const doc = await PDFDocument.load(await readFile(tpl));
const form = doc.getForm();

for (const f of form.getFields()) {
  console.log(`${f.constructor.name.padEnd(14)} | ${f.getName()}`);
}

// Visual map: stamp each text field with the tail of its own name.
for (const f of form.getFields()) {
  if (f.constructor.name === 'PDFTextField') {
    try {
      f.setText(f.getName().split('.').pop());
    } catch {}
  }
}
await writeFile(join(here, '..', 'f1040-labeled.pdf'), await doc.save());
console.error('\nWrote f1040-labeled.pdf — open it to map fields visually.');
```

- [ ] **Step 3: Run discovery and capture the field list**

Run (from repo root):
```bash
cd app/frontend && node app/api/generate-1040/_lib/dump-fields.mjs > app/api/generate-1040/_lib/field-names.txt 2>/dev/null; cd -
```
Expected: `field-names.txt` lists field type + name for every field; `f1040-labeled.pdf` is written next to the template.

- [ ] **Step 4: Identify the fields you need**

Open `app/frontend/app/api/generate-1040/f1040-labeled.pdf` in a PDF viewer. Note the exact field names for: taxpayer first+last name, filing-status checkbox/radio, and lines **1a, 2b, 3a, 3b, 7, 9, 11, 12, 15, 16, 24, 25a, 25b, 25d, 33, 34, 37**. Record them — they are consumed in Task 6, Step 2. Keep `field-names.txt` in the repo; delete `f1040-labeled.pdf` (it's a scratch artifact).

- [ ] **Step 5: Commit**

```bash
rm -f app/frontend/app/api/generate-1040/f1040-labeled.pdf
git add app/frontend/app/api/generate-1040/f1040-2025.pdf app/frontend/app/api/generate-1040/_lib/dump-fields.mjs app/frontend/app/api/generate-1040/_lib/field-names.txt
git commit -m "feat(1040): vendor IRS f1040 template + field-name discovery tool"
```

---

### Task 3: Types and Zod schema

**Files:**
- Create: `app/frontend/app/api/generate-1040/_lib/schema.ts`

- [ ] **Step 1: Write `schema.ts`**

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm --dir app/frontend exec tsc --noEmit`
Expected: no errors (the file only declares types/schemas).

- [ ] **Step 3: Commit**

```bash
git add app/frontend/app/api/generate-1040/_lib/schema.ts
git commit -m "feat(1040): extraction schema + tax types"
```

---

### Task 4: Deterministic tax computation (TDD)

**Files:**
- Create: `app/frontend/app/api/generate-1040/_lib/compute.ts`
- Test: `app/frontend/app/api/generate-1040/_lib/compute.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  standardDeduction,
  taxFromBrackets,
  aggregate,
  computeForm1040,
} from './compute';
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
      [blankDoc({ formType: 'W-2', wages: 30000, fedWithholding: 2000 }),
       blankDoc({ formType: 'W-2', wages: 20000, fedWithholding: 1500 })],
      { taxpayerName: 'Jane Q', filingStatusGuess: 'single' },
    );
    expect(got.wages).toBe(50000);
    expect(got.fedWithholding).toBe(3500);
    expect(got.filingStatus).toBe('single');
  });
  it('defaults filing status to single when no guess', () => {
    expect(aggregate([], { taxpayerName: null, filingStatusGuess: null }).filingStatus).toBe('single');
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir app/frontend exec vitest run app/api/generate-1040/_lib/compute.test.ts`
Expected: FAIL — `compute.ts` has no exports yet.

- [ ] **Step 3: Implement `compute.ts`**

```ts
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

// 2025 ordinary-income brackets: [upperBound, marginalRate]. Verify vs IRS.
type Bracket = [number, number];
const BRACKETS_2025: Record<FilingStatus, Bracket[]> = {
  single: [
    [11925, 0.1], [48475, 0.12], [103350, 0.22], [197300, 0.24],
    [250525, 0.32], [626350, 0.35], [Infinity, 0.37],
  ],
  married_separate: [
    [11925, 0.1], [48475, 0.12], [103350, 0.22], [197300, 0.24],
    [250525, 0.32], [375800, 0.35], [Infinity, 0.37],
  ],
  married_joint: [
    [23850, 0.1], [96950, 0.12], [206700, 0.22], [394600, 0.24],
    [501050, 0.32], [751600, 0.35], [Infinity, 0.37],
  ],
  head_of_household: [
    [17000, 0.1], [64850, 0.12], [103350, 0.22], [197300, 0.24],
    [250525, 0.32], [626350, 0.35], [Infinity, 0.37],
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

const num = (v: number | null | undefined): number => (typeof v === 'number' && isFinite(v) ? v : 0);
const sum = (docs: ExtractedDoc[], pick: (d: ExtractedDoc) => number | null): number =>
  docs.reduce((acc, d) => acc + num(pick(d)), 0);

export function aggregate(
  docs: ExtractedDoc[],
  meta: Pick<ExtractionResult, 'taxpayerName' | 'filingStatusGuess'>,
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
    line1a, line2b, line3a, line3b, line7, line9, line11, line12,
    line15, line16, line24, line25d, line33, line34, line37, refundOrOwe,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir app/frontend exec vitest run app/api/generate-1040/_lib/compute.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add app/frontend/app/api/generate-1040/_lib/compute.ts app/frontend/app/api/generate-1040/_lib/compute.test.ts
git commit -m "feat(1040): deterministic TY2025 tax computation (TDD)"
```

---

### Task 5: Extraction (unpdf text → Qwen structured JSON)

**Files:**
- Create: `app/frontend/app/api/generate-1040/_lib/extract.ts`

- [ ] **Step 1: Write `extract.ts`**

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateObject } from 'ai';
import { extractText, getDocumentProxy } from 'unpdf';
import { ExtractionSchema, type ExtractionResult } from './schema';

export interface UploadedDoc {
  docId: string; // user-claimed type, e.g. "w2"
  name: string; // original filename
  bytes: Uint8Array;
}

export interface ExtractOutcome {
  result: ExtractionResult;
  warnings: string[];
}

const MIN_TEXT_CHARS = 40; // below this we treat a PDF as scanned/unreadable

const SYSTEM_PROMPT = `You are a meticulous US tax-document transcription engine for tax year 2025.
You receive the extracted text of one or more tax documents, each delimited and tagged with the type the user claims it is.
For each document, identify the actual form type and transcribe ONLY the literal box values into the schema.
NEVER calculate, infer, sum, or estimate. Strip "$" and commas; output plain numbers. If a value is not present, use null.
If a block is not a recognizable tax form, set formType "unknown". Return one entry per distinct form found (e.g. two W-2s -> two entries).
Also report the taxpayer's name and, only if clearly determinable (e.g. from a prior-year 1040), a filingStatusGuess; otherwise null.`;

function provider() {
  return createOpenAICompatible({
    name: 'dashscope',
    baseURL: process.env.QWEN_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? '',
  });
}

async function readPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join('\n') : text).trim();
  } catch {
    return '';
  }
}

export async function extractDocuments(docs: UploadedDoc[]): Promise<ExtractOutcome> {
  const warnings: string[] = [];
  const readable: { docId: string; name: string; text: string }[] = [];

  for (const d of docs) {
    const text = await readPdfText(d.bytes);
    if (text.length < MIN_TEXT_CHARS) {
      warnings.push(`"${d.name}" looks scanned or image-only — couldn't read its text, so it was not included.`);
      continue;
    }
    readable.push({ docId: d.docId, name: d.name, text });
  }

  if (readable.length === 0) {
    return { result: { documents: [], taxpayerName: null, filingStatusGuess: null }, warnings };
  }

  const prompt = readable
    .map((d, i) => `=== DOCUMENT ${i + 1} (user labeled: ${d.docId}, file: ${d.name}) ===\n${d.text}`)
    .join('\n\n');

  const apiKey = process.env.QWEN_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? '';
  if (!apiKey) {
    warnings.push('No QWEN_API_KEY configured — returning empty extraction (the form will compute from zeros).');
    return { result: { documents: [], taxpayerName: null, filingStatusGuess: null }, warnings };
  }

  try {
    const { object } = await generateObject({
      model: provider()(process.env.QWEN_MODEL ?? 'qwen-plus'),
      mode: 'json',
      schema: ExtractionSchema,
      system: SYSTEM_PROMPT,
      prompt,
    });
    return { result: object, warnings };
  } catch (err) {
    warnings.push(`Extraction model call failed (${err instanceof Error ? err.message : 'unknown error'}); the form will compute from zeros.`);
    return { result: { documents: [], taxpayerName: null, filingStatusGuess: null }, warnings };
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --dir app/frontend exec tsc --noEmit`
Expected: no errors. (If `getDocumentProxy` typing complains about `Uint8Array`, wrap with `new Uint8Array(bytes)`.)

- [ ] **Step 3: Commit**

```bash
git add app/frontend/app/api/generate-1040/_lib/extract.ts
git commit -m "feat(1040): unpdf text extraction + Qwen structured transcription"
```

---

### Task 6: Fill the official IRS 1040 (pdf-lib)

**Files:**
- Create: `app/frontend/app/api/generate-1040/_lib/fill-1040.ts`

- [ ] **Step 1: Write `fill-1040.ts` scaffold (template load + helpers + XFA drop + fallback overlay)**

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import type { FilingStatus, Form1040 } from './schema';

const TEMPLATE = join(process.cwd(), 'app/api/generate-1040/f1040-2025.pdf');

// Map each computed line to its AcroForm text-field name.
// POPULATE these from Task 2 discovery (field-names.txt / labeled PDF).
// Each value MUST be the exact field name printed by dump-fields.mjs.
const FIELD: Record<string, string> = {
  taxpayerName: 'topmostSubform[0].Page1[0].f1_04[0]',
  line1a: 'topmostSubform[0].Page1[0].f1_32[0]',
  line2b: 'topmostSubform[0].Page1[0].f1_38[0]',
  line3a: 'topmostSubform[0].Page1[0].f1_39[0]',
  line3b: 'topmostSubform[0].Page1[0].f1_40[0]',
  line7: 'topmostSubform[0].Page1[0].f1_47[0]',
  line9: 'topmostSubform[0].Page1[0].f1_49[0]',
  line11: 'topmostSubform[0].Page1[0].f1_51[0]',
  line12: 'topmostSubform[0].Page1[0].f1_52[0]',
  line15: 'topmostSubform[0].Page1[0].f1_55[0]',
  line16: 'topmostSubform[0].Page2[0].f2_02[0]',
  line24: 'topmostSubform[0].Page2[0].f2_10[0]',
  line25d: 'topmostSubform[0].Page2[0].f2_14[0]',
  line33: 'topmostSubform[0].Page2[0].f2_23[0]',
  line34: 'topmostSubform[0].Page2[0].f2_24[0]',
  line37: 'topmostSubform[0].Page2[0].f2_28[0]',
};

// Filing-status checkbox field names (POPULATE from discovery — these are
// often a set of checkboxes c1_X[0]; confirm exact names + on-values).
const FILING_STATUS_CHECKBOX: Record<FilingStatus, string> = {
  single: 'topmostSubform[0].Page1[0].c1_3[0]',
  married_joint: 'topmostSubform[0].Page1[0].c1_3[1]',
  married_separate: 'topmostSubform[0].Page1[0].c1_3[2]',
  head_of_household: 'topmostSubform[0].Page1[0].c1_3[3]',
};

const money = (n: number): string => (n === 0 ? '' : n.toLocaleString('en-US'));

export async function fillForm1040(form1040: Form1040): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(await readFile(TEMPLATE));
  const form = pdfDoc.getForm();

  const setText = (fieldName: string, value: string) => {
    try {
      form.getTextField(fieldName).setText(value);
    } catch {
      /* field name mismatch — overlay fallback handles it below */
    }
  };

  // Text fields
  if (form1040.taxpayerName) setText(FIELD.taxpayerName, form1040.taxpayerName);
  for (const key of ['line1a','line2b','line3a','line3b','line7','line9','line11','line12','line15','line16','line24','line25d','line33','line34','line37'] as const) {
    setText(FIELD[key], money((form1040 as unknown as Record<string, number>)[key]));
  }

  // Filing-status checkbox
  try {
    form.getCheckBox(FILING_STATUS_CHECKBOX[form1040.filingStatus]).check();
  } catch {
    /* ignore — overlay note below records status */
  }

  // Drop XFA so AcroForm values render in every viewer.
  try {
    form.acroForm.dict.delete(PDFName.of('XFA'));
  } catch {
    /* no XFA present */
  }

  // Fallback overlay: stamp a compact computed summary on page 1 so the numbers
  // are visible even if any field name failed to match.
  const page = pdfDoc.getPages()[0];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { refundOrOwe } = form1040;
  const banner =
    refundOrOwe.type === 'refund'
      ? `Refund: $${refundOrOwe.amount.toLocaleString('en-US')}`
      : refundOrOwe.type === 'owe'
        ? `Amount owed: $${refundOrOwe.amount.toLocaleString('en-US')}`
        : 'Balance: $0';
  page.drawText(`AI CPA draft — ${banner}`, {
    x: 36,
    y: 24,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  return await pdfDoc.save();
}
```

- [ ] **Step 2: Correct the field names from Task 2 discovery**

Replace every value in `FIELD` and `FILING_STATUS_CHECKBOX` with the exact names captured in `field-names.txt` / the labeled PDF. The names above are the typical IRS layout but **must be verified** — wrong names fail silently (the overlay still shows the refund/owe banner, but individual lines won't fill).

- [ ] **Step 3: Smoke-test the fill in isolation**

Create a temporary script and run it:
```bash
cd app/frontend && cat > /tmp/fill-smoke.mjs <<'EOF'
import { fillForm1040 } from './app/api/generate-1040/_lib/fill-1040.ts';
EOF
echo "skip: tsx not configured — verify via the endpoint in Task 10 instead"; cd -
```
(We verify fill end-to-end through the route in Task 10 rather than wiring a TS loader here.)

- [ ] **Step 4: Type-check**

Run: `pnpm --dir app/frontend exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/frontend/app/api/generate-1040/_lib/fill-1040.ts
git commit -m "feat(1040): fill official IRS f1040 via pdf-lib (+ overlay fallback)"
```

---

### Task 7: The route handler

**Files:**
- Create: `app/frontend/app/api/generate-1040/route.ts`

- [ ] **Step 1: Write `route.ts`**

```ts
import { NextResponse } from 'next/server';
import { extractDocuments, type UploadedDoc } from './_lib/extract';
import { aggregate, computeForm1040 } from './_lib/compute';
import { fillForm1040 } from './_lib/fill-1040';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const revalidate = 0;

const MAX_FILES = 20;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB/file

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(
      'THIS API ROUTE IS INSECURE. DO NOT USE IN PRODUCTION WITHOUT AN AUTH LAYER.',
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }

  const warnings: string[] = [];
  const docs: UploadedDoc[] = [];
  const entries = formData.getAll('files');

  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (docs.length >= MAX_FILES) {
      warnings.push(`More than ${MAX_FILES} files uploaded — extras ignored.`);
      break;
    }
    if (entry.size > MAX_BYTES) {
      warnings.push(`"${entry.name}" exceeds 15 MB and was skipped.`);
      continue;
    }
    const isPdf = entry.type === 'application/pdf' || entry.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      warnings.push(`"${entry.name}" is not a PDF and was skipped.`);
      continue;
    }
    // docIds are sent as a parallel array; fall back to filename if absent.
    docs.push({
      docId: '',
      name: entry.name,
      bytes: new Uint8Array(await entry.arrayBuffer()),
    });
  }

  // Pair docIds (sent as repeated "docIds" fields, same order as files).
  const docIds = formData.getAll('docIds').map(String);
  docs.forEach((d, i) => (d.docId = docIds[i] ?? 'unknown'));

  // BYPASS: nothing usable uploaded.
  if (docs.length === 0) {
    return NextResponse.json({ bypassed: true, warnings });
  }

  try {
    const { result, warnings: exWarnings } = await extractDocuments(docs);
    warnings.push(...exWarnings);

    const inputs = aggregate(result.documents, {
      taxpayerName: result.taxpayerName,
      filingStatusGuess: result.filingStatusGuess,
    });
    const form1040 = computeForm1040(inputs);
    const pdfBytes = await fillForm1040(form1040);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    const summary = {
      taxYear: form1040.taxYear,
      filingStatus: form1040.filingStatus,
      taxpayerName: form1040.taxpayerName,
      totalIncome: form1040.line9,
      adjustedGrossIncome: form1040.line11,
      standardDeduction: form1040.line12,
      taxableIncome: form1040.line15,
      tax: form1040.line16,
      totalPayments: form1040.line33,
      refundOrOwe: form1040.refundOrOwe,
      documentsRead: result.documents.length,
    };

    return NextResponse.json({ bypassed: false, summary, pdfBase64, warnings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate 1040.', warnings },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm --dir app/frontend exec tsc --noEmit && pnpm --dir app/frontend lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/app/api/generate-1040/route.ts
git commit -m "feat(1040): POST /api/generate-1040 (bypass | extract -> compute -> fill)"
```

---

### Task 8: Wire the upload page to call the endpoint

**Files:**
- Modify: `app/frontend/components/app/upload-view.tsx`

- [ ] **Step 1: Replace the navigate-only button with a POST + loading flow**

In `app/frontend/components/app/upload-view.tsx`:

1. Add `const [busy, setBusy] = useState(false);` next to the existing `files` state.

2. Add this handler inside the component (above the `return`):
```tsx
const onGenerate = async () => {
  setBusy(true);
  try {
    const fd = new FormData();
    for (const [id, file] of Object.entries(files)) {
      fd.append('files', file);
      fd.append('docIds', id);
    }
    const res = await fetch('/api/generate-1040', { method: 'POST', body: fd });
    const data = await res.json();
    if (data?.bypassed) {
      sessionStorage.removeItem('generated1040');
    } else if (data?.pdfBase64) {
      sessionStorage.setItem('generated1040', JSON.stringify({ summary: data.summary, pdfBase64: data.pdfBase64, warnings: data.warnings ?? [] }));
    }
  } catch {
    sessionStorage.removeItem('generated1040');
  } finally {
    router.push('/return');
  }
};
```

3. Change the button to use the handler + busy state:
```tsx
<Button
  size="lg"
  onClick={onGenerate}
  disabled={busy}
  className="rounded-full font-mono text-xs font-bold tracking-wider uppercase"
>
  {busy ? 'Generating…' : 'Generate 1040'}
</Button>
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm --dir app/frontend exec tsc --noEmit && pnpm --dir app/frontend lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/components/app/upload-view.tsx
git commit -m "feat(frontend): POST uploads to /api/generate-1040 with loading state"
```

---

### Task 9: Show the generated 1040 on the return page

**Files:**
- Modify: `app/frontend/components/app/return-view.tsx`

- [ ] **Step 1: Read the stored result and render it (falling back to the placeholder)**

In `app/frontend/components/app/return-view.tsx`, inside `ReturnView`, before the existing
`return`, add state that loads the sessionStorage payload on mount:

```tsx
const [generated, setGenerated] = useState<
  | { summary: any; pdfUrl: string; warnings: string[] }
  | null
>(null);

useEffect(() => {
  const raw = sessionStorage.getItem('generated1040');
  if (!raw) return;
  try {
    const { summary, pdfBase64, warnings } = JSON.parse(raw);
    const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    setGenerated({ summary, pdfUrl: url, warnings: warnings ?? [] });
    return () => URL.revokeObjectURL(url);
  } catch {
    /* ignore malformed payload */
  }
}, []);
```

Add the imports: `import { useEffect, useState } from 'react';`.

In the **non-connected** branch's preview `<section>`:
- Set the `<iframe src>` to `generated?.pdfUrl ?? '/tax-return.pdf'`.
- Replace the subtitle paragraph text with: when `generated`, show the headline from
  `generated.summary.refundOrOwe` (e.g. `Estimated refund: $1,234` / `Estimated amount owed: $…`);
  otherwise keep the existing placeholder copy.
- If `generated.warnings.length`, render them in a small muted list under the headline.

Concrete subtitle block to drop in place of the current `<p>…</p>`:
```tsx
{generated ? (
  <div className="mt-1">
    <p className="text-sm font-medium">
      {generated.summary.refundOrOwe.type === 'refund'
        ? `Estimated refund: $${generated.summary.refundOrOwe.amount.toLocaleString('en-US')}`
        : generated.summary.refundOrOwe.type === 'owe'
          ? `Estimated amount owed: $${generated.summary.refundOrOwe.amount.toLocaleString('en-US')}`
          : 'Estimated balance: $0'}
    </p>
    <p className="text-muted-foreground mt-1 text-xs">
      Draft estimate (tax year {generated.summary.taxYear}) computed from {generated.summary.documentsRead} document(s).
    </p>
    {generated.warnings.length > 0 && (
      <ul className="text-muted-foreground mt-2 list-disc pl-4 text-xs">
        {generated.warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    )}
  </div>
) : (
  <p className="text-muted-foreground mt-1 text-sm">
    Showing the document you uploaded. Your generated 1040 will replace this soon.
  </p>
)}
```

And the iframe:
```tsx
<iframe
  src={generated?.pdfUrl ?? '/tax-return.pdf'}
  title="Your tax return"
  className="h-[80vh] w-full rounded-md bg-white"
/>
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm --dir app/frontend exec tsc --noEmit && pnpm --dir app/frontend lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/frontend/components/app/return-view.tsx
git commit -m "feat(frontend): render generated 1040 + summary on /return"
```

---

### Task 10: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run unit tests**

Run: `pnpm --dir app/frontend test`
Expected: compute tests PASS.

- [ ] **Step 2: Build check**

Run: `pnpm --dir app/frontend build`
Expected: builds without type/route errors. (If the vendored PDF isn't traced into the
build output, add to `app/frontend/next.config.ts`:
`outputFileTracingIncludes: { '/api/generate-1040': ['app/api/generate-1040/f1040-2025.pdf'] }`,
then rebuild.)

- [ ] **Step 3: Bypass path (no key needed)**

Start dev (`pnpm --dir app/frontend dev`) and run:
```bash
curl -s -X POST http://localhost:3000/api/generate-1040 | head -c 200
```
Expected: `{"bypassed":true,"warnings":[]}`.

- [ ] **Step 4: Real path with a sample PDF**

With `QWEN_API_KEY` set in `app/frontend/.env.local`, place a sample text-based W-2 PDF at
`/tmp/w2.pdf` and run:
```bash
curl -s -X POST http://localhost:3000/api/generate-1040 \
  -F "files=@/tmp/w2.pdf" -F "docIds=w2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('summary:', d.get('summary')); print('warnings:', d.get('warnings')); print('pdf bytes:', len(d.get('pdfBase64','')))"
```
Expected: a `summary` with non-zero `totalIncome` matching the W-2, a `pdfBase64` string, and
the refund/owe figure consistent with the compute unit math.

- [ ] **Step 5: Browser pass (preview tools)**

Use the preview workflow: start the dev server, navigate to `/upload`, attach a sample W-2,
click **Generate 1040**, confirm `/return` shows the filled IRS 1040 in the iframe with the
estimated refund/owe headline. Screenshot for the PR.

- [ ] **Step 6: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test(1040): end-to-end verification fixups"
```

---

## Self-Review

**Spec coverage:** bypass-on-empty (Task 7) ✓; extract via Qwen text path + scanned warning (Task 5) ✓; deterministic TY2025 compute (Task 4) ✓; fill official IRS f1040 (Tasks 2, 6) ✓; minimal upload→return wiring (Tasks 8, 9) ✓; deps/env (Task 1) ✓; graceful degradation + dev-only guard (Tasks 5, 7) ✓; verification incl. unit math + browser (Task 10) ✓.

**Placeholder scan:** The only deferred-to-execution values are the IRS AcroForm field names (Task 2 discovery → Task 6 Step 2). This is genuine runtime-discovered data, handled with a concrete discovery tool + a populated default map + a verification step + an overlay fallback — not a vague "TODO". All code steps include full code.

**Type consistency:** `FilingStatus`, `ExtractedDoc`, `ExtractionResult`, `TaxInputs`, `Form1040`, `RefundOrOwe` are defined once in `schema.ts` and used consistently across `compute.ts`, `extract.ts`, `fill-1040.ts`, `route.ts`. Function names (`standardDeduction`, `taxFromBrackets`, `aggregate`, `computeForm1040`, `extractDocuments`, `fillForm1040`) match across tasks. sessionStorage key `generated1040` matches between Task 8 (write) and Task 9 (read).
