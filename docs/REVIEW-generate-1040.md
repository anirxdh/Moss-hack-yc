# Reviewer Guide — `/api/generate-1040`

**PR:** https://github.com/anirxdh/Moss-hack-yc/pull/7 → base `main`
**Status:** GitHub reports **MERGEABLE / CLEAN** (no conflicts with current `main`).
**Branch:** `claude/dazzling-kowalevski-996270`

This guide is for a colleague to review the PR and, if happy, merge it to `main`.

---

## 1. What this PR does

"Generate 1040" used to be fake — picked files lived only in browser state and the
button just navigated to `/return`, which showed a static placeholder PDF. This PR makes
it actually generate a 1040.

`POST /api/generate-1040` (multipart upload of tax PDFs):

| Input | Behavior |
|---|---|
| **No files** | Bypass → `{ bypassed: true }`. No LLM, no work. |
| **≥1 PDF** | Read each PDF with Qwen → compute the 1040 (tax year 2025) in TypeScript → fill the **official IRS Form 1040** with `pdf-lib` → return the filled PDF (base64) + a computed summary. |

The design principle that makes it trustworthy: **the LLM only transcribes raw box values;
all tax arithmetic is deterministic code; the output is the genuine IRS form.**

Full design: [`docs/superpowers/specs/2026-06-07-generate-1040-endpoint-design.md`](superpowers/specs/2026-06-07-generate-1040-endpoint-design.md).

---

## 2. Test it locally in ~5 minutes

```bash
# from repo root
cd app/frontend
pnpm install

# unit + integration tests (no API key needed)
pnpm test                # expect: 16 passed (3 files)

# typecheck + production build (no API key needed)
pnpm exec tsc --noEmit   # expect: clean
pnpm build               # expect: green; route /api/generate-1040 listed
```

**Endpoint smoke test (no key):** the pipeline runs end-to-end and fills the form from
zeros, returning a warning — nothing breaks without a key.

```bash
pnpm dev   # then, in another shell:
# bypass:
curl -s -X POST http://localhost:3000/api/generate-1040 | head -c 120
# -> {"bypassed":true,"warnings":[]}
# pipeline (any PDF; without a key you'll get a zero-form + a "no key"/"scanned" warning):
curl -s -X POST http://localhost:3000/api/generate-1040 -F "files=@/path/to/any.pdf" -F "docIds=w2" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('summary:',d.get('summary'));print('warnings:',d.get('warnings'))"
```

**To see REAL extracted numbers** (otherwise everything computes from zeros), add a DashScope
key to `app/frontend/.env.local` (file does not exist yet — create it):

```
QWEN_API_KEY=<dashscope key>
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Then in the browser: `/upload` → attach a **text-based** W-2/1099 PDF → **Generate 1040** →
`/return` shows the filled IRS 1040 + an "Estimated refund/owed" headline.

> Note: the app also needs the existing LiveKit env vars for the "Talk to CPA" voice flow;
> they are unrelated to this endpoint. The `/api/token` 500 and the `/return`→`/` bounce you
> may see without LiveKit env are pre-existing behavior, not part of this PR.

---

## 3. What changed (reading order)

All logic lives in the endpoint; the frontend only POSTs and renders.

| File | What to look at |
|---|---|
| `app/frontend/app/api/generate-1040/_lib/schema.ts` | Zod extraction schema + `TaxInputs` / `Form1040` / `Form1040Summary` types. Start here. |
| `…/_lib/compute.ts` | **The tax math.** 2025 standard deductions + brackets, line aggregation, refund/owe, `summarize()`. This is the correctness-critical file. |
| `…/_lib/compute.test.ts` | 13 unit tests for the math (bracket boundaries, multi-W-2, refund vs owe, zero). |
| `…/_lib/extract.ts` | Qwen call (DashScope, OpenAI-compatible, raw `fetch` + JSON mode + Zod validation), scanned-PDF detection, fail-safe fallbacks. |
| `…/_lib/fill-1040.ts` | Maps computed lines → IRS AcroForm field names; overlay "X" for filing status; negative-as-parentheses; draft banner. |
| `…/_lib/fill-1040.test.ts` | Verifies the field map writes the right values into the real form. |
| `…/route.ts` | Orchestrator: multipart parse, guards, bypass, error handling, dev-only guard. |
| `…/route.test.ts` | Integration tests: bypass + full pipeline. |
| `components/app/upload-view.tsx` | POST + loading state. |
| `components/app/return-view.tsx` | Renders generated PDF (blob URL) + summary + warnings; falls back to placeholder. |
| `…/_lib/dump-geometry.mjs`, `field-names.txt` | How the IRS field names were discovered (geometry-matched to the form's own labels). Reference only. |
| `f1040-2025.pdf` | Vendored official IRS template (binary; don't review line-by-line). |

---

## 4. Review checklist

**Correctness (highest priority)**
- [ ] 2025 standard deductions in `compute.ts` are **$15,750 / $31,500 / $23,625** (Single·MFS / MFJ / HoH) — these match the amounts printed on the vendored form, and reflect the One Big Beautiful Bill Act increase (NOT the older $15,000/$30,000/$22,500 projection).
- [ ] 2025 ordinary brackets per filing status look right.
- [ ] Spot-check one scenario by hand, e.g. single, $50k wages, $4k withheld → taxable $34,250, tax $3,872, refund $128 (matches `compute.test.ts`).
- [ ] Refund vs. owe vs. even logic; rounding; negative/zero handling.

**PDF fill**
- [ ] Field map in `fill-1040.ts` is sane (each line → its labeled box). Best verified by adding a key and eyeballing a real filled return at `/return`.
- [ ] Overlay-"X" filing-status approach is acceptable (the IRS checkbox is a shared-widget radio, so AcroForm `.check()` would tick two boxes).

**Robustness / security**
- [ ] LLM trust boundary: model output is Zod-validated; math is in code; no `eval`-of-LLM.
- [ ] Fail-safe: missing key / model error / bad shape / scanned PDF → warning + zero-form, never a 500.
- [ ] No PII logged; API key never echoed; `AbortSignal.timeout` on the model call.
- [ ] Dev-only guard (`route.ts` returns 403 outside development) — confirm that matches how you'll deploy.

**Frontend**
- [ ] `sessionStorage` hand-off + blob-URL lifecycle (created/revoked) in `return-view.tsx`.
- [ ] Loading state + navigation in `upload-view.tsx`.

---

## 5. Already reviewed & fixed (transparency)

This branch went through a full code-review pass; the findings below were fixed in commit
`fix(1040): address code review …` (and are covered by tests/build):

- **Standard deductions were wrong** (used the pre-OBBBA $15,000/$30,000/$22,500 projection, which even contradicted the form's printed amounts) → corrected to $15,750/$31,500/$23,625, test assertions updated.
- **`pnpm build` was failing** because `route.test.ts` had type/lint errors (it was added after an earlier build check) → fixed; build is green.
- **Capital losses rendered blank** on the form → now shown in parentheses.
- **Client summary was `any`/duplicated** → shared `Form1040Summary` type.
- Minor: dead discovery script removed, 45s extraction timeout, prompt-injection guard, no-op `revalidate` dropped.

---

## 6. Known limitations (v1 scope — by design, not bugs)

- Standard deduction only (no itemizing/Schedule A); qualified dividends / long-term gains taxed at ordinary rates; output is labeled a **draft estimate**.
- Reads **text-based PDFs**; scanned/photo PDFs are detected and warned, not OCR'd (a qwen-vl + rasterization path is a documented follow-up).
- Extraction uses DashScope via raw `fetch` (not `@ai-sdk/openai-compatible`, whose v2 emits a model spec incompatible with the installed `ai@5`).
- The **live Qwen extraction quality** is the one path automated tests can't cover — needs a key to validate against real documents.

---

## 7. To merge to `main`

The PR is mergeable as-is. Once the checklist passes:

```
# via GitHub UI: review PR #7, approve, "Squash and merge" (or your team's convention).
# or via CLI:
gh pr merge 7 --squash --delete-branch
```

After merge, configure `QWEN_API_KEY` (+ existing LiveKit vars) in the deploy environment so
extraction produces real numbers.
