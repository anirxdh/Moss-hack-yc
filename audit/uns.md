# Unsiloed AI — Coverage Audit

**Report audited:** `/Users/anirudh/Desktop/yc-mosshack/docs/UNSILOED.md`
**Ground truth index:** `/Users/anirudh/Desktop/yc-mosshack/raw/uns-llms.txt`
**Full content spot-checked:** `/Users/anirudh/Desktop/yc-mosshack/raw/uns-llms-full.txt`

**Index inventory:** 35 lines indexed. Breakdown:
- 30 markdown doc pages (the real denominator)
- 1 empty `index.md` entry (line 34, no title/desc — landing page)
- 4 OpenAPI/JSON spec files (`openapi-v1/v2/v3.json`, `openapi.json`)
- 1 test fixture JSON (`sample_spec.json`)

**In-scope denominator:** 30 doc pages + the `index.md` landing = 31 human-readable pages. The 5 raw JSON specs (`*.json`) are machine artifacts, out of scope for a battle-pack narrative. Scoring uses the **30 doc pages** as the in-scope denominator (index.md is a near-empty redirect; counted as intentional omission).

Verdict up front: **coverage is excellent.** All 30 doc pages are represented, most with full endpoint/param/JSON fidelity. The handful of gaps are minor depth items (one extra segment type, one extra status value, a couple of v3 error nuances), not missing endpoints.

---

## Section: api-reference (API Reference pages)

| Page | Bucket | Note |
| --- | --- | --- |
| Classify Document (`/classify`) | COVERED | Section 5: endpoint, `pdf_file`/`file_url` + `categories` JSON array of `{name, description?}`, 202 submit response, completed JSON with `classification`/`confidence`/`page_results[]`. |
| Get Classification Result (`GET /classify/{job_id}`) | COVERED | Poll-to-completed flow + full result JSON shown. Polling-strategy code sample and progress-message granularity from raw not reproduced, but status vocab + result shape present. |
| Extract Data (`POST /v2/extract`) | COVERED | Section 4: all request fields (`pdf_file`/`file_url`/`schema_data`/`model`/`enable_citations`), model tiers alpha/beta/gamma/delta, submit response, citations on/off shapes, schema strict-mode rules. |
| Get Extraction Result (`GET /extract/{job_id}`) | COVERED | Field object `{value, score, page_no, bboxes?}`, bbox coord format `[left,top,right,bottom]` in PDF points, array-field handling, `min_confidence_score` gate, confidence bands. |
| Get Organization Usage (`GET /org/get_usage`) | COVERED | Section 7: endpoint + all response fields (`org_id`, `org_name`, `current_usage`, `usage_limit`, `remaining_quota`, `last_billed_date` 30-day reset). |
| Get Parse Result (`GET /parse/{job_id}`) | COVERED | Query params (`base64_urls`, `include_chunks`, `output_file`, `include_url`), Succeeded response shape, status vocab. Minor: `Cancelled` status value (raw lists it as a 5th v1 status) not in report's status table. |
| Parse Document (`POST /parse`) | COVERED | Section 1: the deepest section. Full multipart param table (~25 fields), `segment_analysis` object, submit + Succeeded JSON, segment-type list, processing modes. Best-covered page. |
| Parse Document (Presigned Upload) (`POST /v2/parse/upload`) | COVERED | Section 2: 4-step presigned flow, `AwaitingUpload`→`Queued`→`Processing` status, same result endpoint as v1. |
| Parse Document (v3) (`POST /v3/parse`) | COVERED | Section 3: separate base URL + `X-API-Key` auth, 4 routes, 3 body shapes, presigned 3-call flow, batch `documents[]`, 24h retention, rate limits (100/day, 2 RPS), error codes, `result_url` overflow fallback. |
| Get Split Result (`GET /splitter/{job_id}`) | COVERED | Section 6: completed shape with `result.files[]` (`name`/`fileId`/`type`/`path`/`full_path`/`confidence_score`), `parameters` echo. |
| Split Document (`POST /splitter`) | COVERED | Section 6: endpoint, `file`/`file_url` + `categories`, curl example, download-then-parse loop. |

---

## Section: document-processing (Conceptual / guide pages)

| Page | Bucket | Note |
| --- | --- | --- |
| Classification Overview | COVERED | Concept (route docs to categories w/ per-page confidence) captured in Section 5 intro + Recipe B. |
| Getting Started With Classification | COVERED | Submit-categories-then-read flow shown; cheat-sheet curl. |
| Classification Response Format | COVERED | Completed JSON with per-page results reproduced verbatim. |
| Extract Overview | COVERED | "JSON schema → typed fields + confidence" thesis in Section 4 intro + one-paragraph summary. |
| Getting Started With Extract | COVERED | Quickstart submit/poll flow + schema example present. |
| Extract Response Format | COVERED | `{value, score}` per field, array/nested `line_items` shape, `metadata.order`/`schema` echo. Report shows the citations variant; raw's no-citations `metadata` block lightly summarized. |
| Schemas | COVERED | Strict-mode rules (root object, properties, required, `additionalProperties:false` everywhere), supported types incl. `null` combo, arrays-of-objects pattern, dashboard schema builder note. |
| Element Types | PARTIAL | 13 of 14 types covered with rendering rules (md/html mapping). Report lists Title/SectionHeader/Text/Table/Picture/Caption/Formula/Footnote/ListItem/PageHeader/PageFooter + KeyValuePair/Signature/Seal. **Missing: the `Page` segment type** (full-page segment, appears under `page_by_page`). Per-type quirks (Signature has no `content`/`image`; Formula returns LaTeX in `$...$`; Picture md/html is an AI description) are not spelled out but are secondary. |
| Parse Overview | COVERED | "Documents → ordered Markdown chunks + bbox + OCR + labeled segments" captured throughout Section 1. |
| Presigned URLs | COVERED | Parse-from-URL via `url` field documented in Section 1 + cheat-sheet item 3; `file` XOR `url` rule called out in Gotchas. |
| Processing Modes | COVERED | Fast/Accurate/Agentic preset table reproduced exactly (`ocr_engine`, `Table.html`, `Table.model_id`, `agentic_ocr`, `merge_tables`) + hackathon guidance. |
| Parsing Response Format | COVERED | Canonical Succeeded JSON + field-by-field "fields you'll actually use" list; `include_url` URL-nulling caveat documented. |
| Getting Started With Splitting | COVERED | Submit-bundle-then-download-one-PDF-per-doc flow in Section 6 + cheat-sheet. |
| Splitting Response Format | COVERED | `result.files[]` field reference + `parameters` echo (`classes`, `page_count`, `enable_reordering`, `category_descriptions`). |
| Splitting Overview | COVERED | Concept + "how it works" (classify pages, group adjacent, one PDF per doc) in Section 6 intro + Recipe B. Raw's "Common Categories" list (by industry) not reproduced — non-essential. |

---

## Section: top-level / integrations

| Page | Bucket | Note |
| --- | --- | --- |
| General FAQ | COVERED | Formats, accuracy/benchmark claims (beats LlamaIndex/Gemini/Mistral/Unstructured.io), on-prem AWS/Azure/GCP + air-gapped, pricing model, support channels — all surfaced across Platform fundamentals + intro paragraph. |
| `index.md` (landing) | OMITTED-INTENTIONAL | Empty index entry in the llms.txt (no title/desc); landing redirect, no unique content. |
| Claude Integration | COVERED | Section 8: all 5 tool schemas named (`unsiloed_parse_document`, `_extract_data`, `_classify_document`, `_split_document`, `_get_job_result`), public-URL-only constraint, install commands, executor mapping. Full copy-paste tool JSON + agentic-loop code from raw not reproduced (it's long boilerplate) — names + behavior captured. |
| Quickstart | COVERED | Section "Quickstart — hello world": submit `/parse`, poll, read `chunks[].embed`. Matches raw quickstart intent. |

---

## Section: OpenAPI / JSON specs (machine artifacts — out of scope)

| Page | Bucket | Note |
| --- | --- | --- |
| `openapi-v1.json` | OMITTED-INTENTIONAL | Raw OpenAPI spec; its content is reflected through the human-readable Parse pages. |
| `openapi-v2.json` | OMITTED-INTENTIONAL | Same — v2 parse covered narratively. |
| `openapi-v3.json` | OMITTED-INTENTIONAL | Same — v3 parse covered narratively. |
| `openapi.json` | OMITTED-INTENTIONAL | Aggregate spec; covered via endpoint sections. |
| `tooling/tests/fixtures/sample_spec.json` | OMITTED-INTENTIONAL | Test fixture, not a doc page. |

---

## Gaps to patch (specific missing facts)

1. **`Page` segment type (Element Types page).** The report's segment-type list omits the `Page` type — a full-page segment returned when `layout_analysis=page_by_page` (raw line 2232/2975 lists `Page`: "Full page segments"). Add it to the segment-type enumeration. *Importance: low.*

2. **`Cancelled` parse status (Get Parse Result page).** The report's status table for `/parse` (v1) lists `Succeeded`/`Failed` + in-progress states but omits `Cancelled` (raw line 1823 + 2131 lists it as a 5th terminal value: "Job was cancelled before processing completed"). A poller switch should handle it. *Importance: low.*

3. **Element Types per-segment quirks (Element Types page).** Report does not spell out a few useful field-shape facts: `Signature` segments carry **no `content` and no `image`** (description only); `Formula` returns **LaTeX in `$...$`** in md/html with a less-reliable plain-text `content`; `Picture`/`Signature` md/html are **AI-generated descriptions**, not the image bytes. Useful for anyone rendering segments. *Importance: low.*

4. **v3 batch `source_url`/`pdf_count` response fields (Parse v3 page).** Report describes batch `documents[]` but does not name the batch-level `source_url` and `pdf_count` fields, nor the failed-batch shape `{status:"failed", error}`. *Importance: low.*

5. **Splitting "Common Categories" taxonomy (Splitting Overview page).** Raw offers ready-made category groupings by industry (Business/Financial/Legal/Healthcare/HR/Academic). Not reproduced — would be a nice demo crib. *Importance: low.*

None of these are missing endpoints or missing pages — all are depth nuances on already-covered pages.

---

## Intentionally omitted (out of scope per policy)

- `index.md` — empty landing-page entry, no unique content.
- `openapi-v1.json`, `openapi-v2.json`, `openapi-v3.json`, `openapi.json` — raw OpenAPI specs; their substance is reflected through the human-readable endpoint sections.
- `tooling/tests/fixtures/sample_spec.json` — test fixture, not documentation.
- Long verbatim boilerplate: full Anthropic tool-use JSON arrays and the full agentic-loop executor script from the Claude Integration page (named + behaviorally described instead of pasted).

---

## Scoring

- In-scope doc pages: **30**
- COVERED: **29**
- PARTIAL: **1** (Element Types)
- MISSED-IN-SCOPE: **0**
- Coverage of in-scope = (29 + 1) / 30 = **100%**
- Intentionally omitted (out of scope): **5** JSON artifacts + 1 empty index = 6 items.
