# Generate 1040 Endpoint — Design

**Date:** 2026-06-07
**Status:** Draft for review
**Branch:** `claude/dazzling-kowalevski-996270`

## 1. Problem

Today, clicking **Generate 1040** on `/upload` does nothing real:

- Picked files live only in browser state and are never uploaded
  ([upload-view.tsx:104-110](../../../app/frontend/components/app/upload-view.tsx)).
- The button just runs `router.push('/return')`.
- `/return` shows a hardcoded, gitignored `/tax-return.pdf` placeholder that literally
  says *"Your generated 1040 will replace this soon."*
  ([return-view.tsx:59-74](../../../app/frontend/components/app/return-view.tsx)).

We want a real API endpoint that, **when PDFs are uploaded**, reads them, computes a 1040,
and fills the **official IRS Form 1040** with the computed numbers — and **bypasses cleanly
when nothing is uploaded**. All generation logic lives in the endpoint; the frontend only
POSTs the files and displays the result.

## 2. Goals / Non-goals

**Goals**
- A `POST /api/generate-1040` endpoint that holds 100% of the generation logic.
- Empty upload → bypass (no LLM call, no generation).
- Non-empty upload → extract → compute → fill the official IRS 1040 → return it.
- Output is a *genuinely computed* 1040 on the real IRS form, not a faked render.
- Minimal frontend wiring so the result is demoable end-to-end.

**Non-goals (v1)**
- Filing/transmitting to the IRS.
- Itemized deductions (Schedule A), credits, or every schedule. Standard deduction only.
- Preferential qualified-dividend / long-term-capital-gain rates (taxed at ordinary rates in v1).
- True OCR of scanned/image-only PDFs (documented follow-up; see §9).
- Authentication / multi-tenant persistence (dev/demo only, mirrors existing token route).

## 3. Behavior contract

`POST /api/generate-1040`, `multipart/form-data` with one or more files plus a parallel
list of doc-type ids (`w2`, `1099int`, …, matching `tax-documents.ts`).

| Input | Response |
|---|---|
| **No files** | `200 { bypassed: true }`. No LLM, no PDF work. |
| **≥1 file** | `200 { bypassed: false, summary, pdfBase64, warnings[] }`. |
| **Hard failure** | `500 { error }` — but the pipeline is designed to degrade to a valid (possibly zero-value) 1040 with `warnings` rather than 500 wherever possible. |

`summary` is the computed line items (income, AGI, standard deduction, taxable income, tax,
payments, refund/owe + which) for an at-a-glance UI panel. `pdfBase64` is the filled IRS 1040.

## 4. Architecture & data flow

```
/upload (UploadView)                         POST /api/generate-1040  (runtime: 'nodejs')
  files in React state                         1. parse multipart -> [{ docId, name, bytes }]
  click "Generate 1040"                         2. EXTRACT  (Qwen) -> structured JSON
      │ FormData(files + docIds)                3. COMPUTE  (pure TS) -> 1040 lines + tax
      └──────────── POST ───────────────►       4. FILL     (pdf-lib) -> official f1040 bytes
                                          ◄── { bypassed | summary, pdfBase64, warnings }
  store result in sessionStorage
  router.push('/return')
                                             /return (ReturnView)
                                               read sessionStorage -> show real 1040 + summary
                                               (nothing stored -> existing placeholder)
```

All four stages live under `app/frontend/app/api/generate-1040/` (route + `_lib/`), imported
only by the route — so "all the logic is in the endpoint" holds, while staying modular.

## 5. Endpoint internals

### Stage 1 — Parse
Read `FormData`. Collect each `File` + its `docId`. If zero files → return `{ bypassed: true }`.
Enforce simple guards: PDF mime/extension, per-file size cap (e.g. 15 MB), max file count
(e.g. 20). Reject obviously-wrong files into `warnings`, don't 500.

### Stage 2 — Extract (Qwen via DashScope, the "great prompt")
- For each PDF, extract text with `unpdf` (`extractText`). Record per-doc character count.
- Docs with too little text (likely scanned) are **not** sent blank — they're flagged in
  `warnings` ("<name> looks scanned/image-only; couldn't read it — values not included").
- Concatenate readable docs into one prompt (clearly delimited, each tagged with its
  user-claimed `docId`/code as a hint) and make **one** `generateObject()` call:
  - Provider: `@ai-sdk/openai-compatible` `createOpenAICompatible({ baseURL: QWEN_BASE_URL, apiKey: QWEN_API_KEY, name: 'dashscope' })`.
  - Model: `QWEN_MODEL` (default `qwen-plus`).
  - `mode: 'json'`, `schema: ExtractionSchema` (Zod). The SDK validates and retries on
    schema mismatch, so we get a typed, valid object back.
- The model's only job is **transcription of raw box values** — never tax math (see §6 prompt).

### Stage 3 — Compute (deterministic TypeScript — no LLM)
Aggregate the extracted documents into canonical inputs, then compute 1040 lines for **tax
year 2025**:

- `1a` wages = Σ W-2 box 1
- `2b` taxable interest = Σ 1099-INT box 1
- `3a` qualified dividends = Σ 1099-DIV box 1b; `3b` ordinary dividends = Σ 1099-DIV box 1a
- `7` capital gain/(loss) = Σ 1099-B gain/loss
- `8` additional income (Schedule 1) = 0 (v1)
- `9` total income = 1a + 2b + 3b + 7 + 8
- `10` adjustments = 0 (v1) → `11` AGI = 9 − 10
- `12` standard deduction by filing status (2025): Single/MFS **$15,750**, MFJ **$31,500**, HoH **$23,625** (One Big Beautiful Bill Act amounts, as printed on the 2025 Form 1040 — not the earlier $15,000/$30,000/$22,500 projection)
- `13` QBI = 0 → `14` = 12 + 13
- `15` taxable income = max(0, 11 − 14)
- `16` tax = `taxFromBrackets(15, filingStatus)` (2025 ordinary brackets)
- `22` = 16; `23` other taxes = 0; `24` total tax = 22 + 23
- `25` withholding = `25a` (Σ W-2 box 2) + `25b` (Σ 1099 withholding) → `25d` total
- `26`+ estimated = 0 → `33` total payments
- If `33 > 24`: `34` overpayment, `35a` refund. Else `37` amount you owe.

**Filing status:** default **Single**; if a prior-year 1040 is uploaded or the model returns a
confident `filingStatusGuess`, use that. Surfaced in `summary` either way.

**2025 ordinary brackets** (to encode; verify against IRS Rev. Proc. 2024-40 during build):
- Single: 10% ≤ 11,925 · 12% ≤ 48,475 · 22% ≤ 103,350 · 24% ≤ 197,300 · 32% ≤ 250,525 · 35% ≤ 626,350 · 37% >
- MFJ: 10% ≤ 23,850 · 12% ≤ 96,950 · 22% ≤ 206,700 · 24% ≤ 394,600 · 32% ≤ 501,050 · 35% ≤ 751,600 · 37% >
- HoH: 10% ≤ 17,000 · 12% ≤ 64,850 · 22% ≤ 103,350 · 24% ≤ 197,300 · 32% ≤ 250,525 · 35% ≤ 626,350 · 37% >

Doing the arithmetic in code (not the LLM) is what makes the result correct rather than
plausible-looking, and is unit-testable.

### Stage 4 — Fill (pdf-lib)
- Load the vendored `f1040-2025.pdf` from disk (`fs.readFile(path.join(process.cwd(), 'app/api/generate-1040/f1040-2025.pdf'))`).
- Map each computed line → its AcroForm field name; set text fields, the filing-status
  checkbox, and taxpayer name (from extraction if present).
- Drop the XFA layer (`form.acroForm.dict.delete(PDFName.of('XFA'))`) so values render in all
  viewers; optionally flatten. Return `Uint8Array` → base64.

## 6. Extraction prompt (sketch)

> **System:** You are a meticulous US tax-document transcription engine for **tax year 2025**.
> You receive the extracted text of one or more tax documents. For each document, identify the
> form type and transcribe **only the literal box values** into the schema.
> **Never calculate, infer, sum, or estimate.** Strip `$` and commas; numbers only. If a field
> is absent, use `null`. If a block of text is not a recognizable tax form, set
> `formType: "unknown"`. Return one schema entry per distinct form found (e.g. two W-2s → two
> entries).

Paired with `generateObject` + Zod, output is forced into the schema (auto-retry on mismatch).

## 7. Zod schema (shape)

```ts
const Money = z.number().nullable();
const ExtractedDoc = z.object({
  formType: z.enum(['W-2','1099-INT','1099-DIV','1099-B','1099-R','1099-G','SSA-1099','1040-prior','unknown']),
  sourceLabel: z.string().nullable(),     // employer/payer name if visible
  wages: Money,                           // W-2 box 1
  fedWithholding: Money,                  // W-2 box 2 / 1099 withholding
  interestIncome: Money,                  // 1099-INT box 1
  ordinaryDividends: Money,               // 1099-DIV box 1a
  qualifiedDividends: Money,              // 1099-DIV box 1b
  capitalGain: Money,                     // 1099-B realized gain/loss
  otherIncome: Money,
  notes: z.string().nullable(),
});
const ExtractionSchema = z.object({
  documents: z.array(ExtractedDoc),
  taxpayerName: z.string().nullable(),
  filingStatusGuess: z.enum(['single','married_joint','married_separate','head_of_household']).nullable(),
});
```

## 8. Files, dependencies, env

**New (endpoint-side)**
- `app/frontend/app/api/generate-1040/route.ts` — orchestrator (`export const runtime = 'nodejs'`).
- `app/frontend/app/api/generate-1040/_lib/schema.ts` — Zod schemas + TS types.
- `app/frontend/app/api/generate-1040/_lib/extract.ts` — `unpdf` text + Qwen `generateObject`.
- `app/frontend/app/api/generate-1040/_lib/compute.ts` — deterministic 1040 math + brackets.
- `app/frontend/app/api/generate-1040/_lib/fill-1040.ts` — pdf-lib filling + field map.
- `app/frontend/app/api/generate-1040/f1040-2025.pdf` — vendored IRS template (from `irs.gov/pub/irs-pdf/f1040.pdf`).

**Modified (minimal wiring)**
- `components/app/upload-view.tsx` — build FormData, POST, loading state, store result, navigate.
- `components/app/return-view.tsx` — read sessionStorage; show filled 1040 + summary; else placeholder.
- `app/frontend/package.json` — add deps.
- `app/frontend/.env.example` — add Qwen vars.

**Dependencies (frontend):** `@ai-sdk/openai-compatible`, `unpdf`, `pdf-lib`, `zod`
(`ai` v5 already present). For production bundling, add `outputFileTracingIncludes` so the
vendored PDF ships; dev reads it from disk directly.

**Env (`frontend/.env.local`):**
```
QWEN_API_KEY=...                                   # DashScope key (DASHSCOPE_API_KEY also accepted)
QWEN_MODEL=qwen-plus                               # qwen-max / qwen-turbo also fine
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

## 9. Error handling, edge cases, security

- **Bypass** when no files (per contract).
- **Scanned / unreadable PDF** → not sent blank; flagged in `warnings`. (Vision OCR via
  `qwen-vl` + PDF→image rasterization is the documented follow-up if scanned docs must work.)
- **`unknown` form** → excluded from totals, surfaced in `warnings`.
- **Qwen unavailable / key missing / call fails** → don't 500; compute from whatever was
  extracted (possibly zeros) and return the filled PDF with a `warnings` entry, so the demo
  still produces a 1040.
- **Field-map miss in the IRS PDF** (the main risk) → fallback: draw the value as overlay text
  at fixed coordinates so no line silently goes blank. Mitigated up front by an introspection
  step that dumps every AcroForm field name/type before mapping.
- **Dev-only guard** mirroring `api/token/route.ts` (refuse outside development; PII never logged).

## 10. Verification plan

- Unit tests for `compute.ts`: W-2 only; W-2 + 1099-INT; refund vs. owe; zero income;
  bracket boundaries; filing-status deductions.
- `curl` the endpoint with a sample W-2 PDF → confirm extracted JSON and a filled PDF whose
  lines 1a / 16 / 34(or 37) match the unit math.
- Browser pass: upload → real numbers on the rendered IRS 1040 at `/return`; empty → bypass.

## 11. Key assumptions (please confirm on review)

1. Tax year **2025**; standard deduction only; QD/LTCG at ordinary rates; output labeled a
   **draft estimate**.
2. Filing status defaults to **Single** unless inferred from a prior 1040 / model guess.
3. v1 reads **text-based PDFs**; scanned/image PDFs are warned, not OCR'd.
4. **Qwen `qwen-plus`** via DashScope OpenAI-compatible endpoint; `QWEN_API_KEY` present in
   `frontend/.env.local`.
5. Result is passed upload→return via **sessionStorage** (filled 1040 is small; fits limits).
6. Dev/demo scope; no auth, no server-side persistence of PII.
