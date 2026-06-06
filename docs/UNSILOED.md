# Unsiloed AI — The Ingest Half of Your Retrieval Demo

> Source of truth: local raw docs at `/Users/anirudh/Desktop/yc-mosshack/raw/uns-llms-full.txt` (mirror of `docs.unsiloed.ai`). All endpoints, headers, JSON, and code below are transcribed verbatim from those docs.

---

## What is Unsiloed in one paragraph

**Unsiloed AI (YC F25)** is "Agentic OCR for AI pipelines that need to trust the page" — a REST API that ingests messy, multimodal, unstructured documents (PDFs, scans, slides, spreadsheets, images, 20+ formats) and turns them into **clean Markdown chunks** and **structured JSON**, every value carrying a **confidence score** and a **bounding box**. It uses vision + layout models alongside OCR, so tables that wrap columns, multi-column reading order, formulas, and scanned forms survive the parse instead of getting mangled the way generic OCR / text-only LLM parsers do. The API exposes **four core operations** — **Parse** (document → ordered Markdown chunks + segments), **Extract** (document + JSON Schema → typed fields with citations), **Classify** (document → category with per-page confidence), and **Split** (one bundled PDF → one PDF per detected document). Everything is **job-based async**: you `POST` a file (or URL), get a `job_id`, and poll a `GET` endpoint until the job reaches `Succeeded`/`done`/`completed`.

## Why it matters for a voice-AI hackathon (and which track)

The Moss hackathon thesis is: **voice is cheap, retrieval is the bottleneck.** Retrieval is only as good as what you put in the index — and real customer documents are PDFs: 400-page equipment manuals, insurance policies, vendor contracts, lab reports, SEC filings, scanned intake forms. **Unsiloed is the INGEST half of the loop: Unsiloed parses → Moss indexes → the LiveKit voice agent answers in real time.** Concretely:

- **Support track (best fit):** A CS voice bot that pulls docs + user history. Unsiloed converts the product manual / policy / warranty PDF into `chunks[].embed` Markdown that drops straight into a Moss index. The bot retrieves and speaks the answer with a citation (page number + bbox).
- **Co-Pilot track:** An ambient agent listening to a call surfaces the exact clause of a contract or the exact spec from a datasheet. Unsiloed's per-segment `bbox` + `page_number` let you show *where* on the page the answer came from.
- **Lead Gen track:** Drop an RFP / spec sheet / pitch deck PDF, parse + extract structured fields (budget, decision-maker, requirements) with confidence scores, and let the voice agent qualify the lead live.

The killer property for a demo: **`chunks[].embed` is Markdown that's already chunked and embedding-ready** — no custom chunking code, no reading-order cleanup. That's the glue that makes a "drop a PDF, ask it out loud" demo work in 21 hours.

## Quickstart — "hello world" (parse a PDF → Markdown chunks)

Base URL for everything (v1/v2 parse, extract, classify, split): **`https://prod.visionapi.unsiloed.ai`**. Auth header: **`api-key: <your-key>`**. Get a key by signing up (`https://cal.com/aman-mishra-p0ry57/15min`); export it as `UNSILOED_API_KEY`.

```bash
export UNSILOED_API_KEY="your-api-key"
```

```python
import json, os, time, requests

API_KEY = os.environ["UNSILOED_API_KEY"]
BASE_URL = "https://prod.visionapi.unsiloed.ai"

# 1. Submit
with open("document.pdf", "rb") as f:
    r = requests.post(
        f"{BASE_URL}/parse",
        headers={"api-key": API_KEY},
        files={"file": ("document.pdf", f, "application/pdf")},
    )
r.raise_for_status()
job_id = r.json()["job_id"]
print("Job submitted:", job_id)

# 2. Poll until Succeeded
while True:
    result = requests.get(f"{BASE_URL}/parse/{job_id}", headers={"api-key": API_KEY}).json()
    if result["status"] == "Succeeded":
        break
    if result["status"] == "Failed":
        raise RuntimeError(result.get("message", "parse job failed"))
    time.sleep(5)

# 3. Each chunk's `embed` is embedding-ready Markdown -> feed straight to Moss
for chunk in result["chunks"]:
    print(chunk["embed"])
```

`chunks[].embed` for the sample 1-page sales report comes back as ready-to-embed Markdown including a reconstructed table:

```markdown
## Q1 2024 Sales Report
The following table summarises regional sales performance for Q1 2024.
| Region | Sales Rep | Units Sold | Revenue ($) | Target ($) | % of Target |
| --- | --- | --- | --- | --- | --- |
| North | Alice Brown | 1,240 | 186,000 | 175,000 | 106% |
| South | Bob Smith | 980 | 147,000 | 160,000 | 92% |
```

---

# Platform fundamentals (read this once)

| Thing | Value |
| --- | --- |
| **Base URL (v1/v2 parse, extract, classify, split, org)** | `https://prod.visionapi.unsiloed.ai` |
| **Base URL (v3 parse)** | `https://prod.visionapi.unsiloed.ai/v3/parse` |
| **Docs host** | `docs.unsiloed.ai` |
| **Dashboard / playground** | `app.unsiloed.ai/playground/Extractor` |
| **Auth header (v1/v2/extract/classify/split)** | `api-key: <key>` (key format `unsiloed_[hash]`) |
| **Auth header (v3 only)** | `X-API-Key: <key>` (separate keys, request via `aman@unsiloed.ai`) |
| **Processing model** | Job-based async: `POST` returns `job_id`, poll `GET .../{job_id}` |
| **Output formats** | Markdown + structured JSON, with confidence scores + bounding boxes |
| **Max file size** | Parse v1: 100MB (form says 50MB note for classify); Extract: 100MB; v3: 50MB (3MB inline) |
| **SDKs** | No official SDK — plain REST. Examples in cURL, Python (`requests`), JS/TS (`fetch`). Anthropic tool-use schemas provided. |
| **Supported formats** | PDF, PNG, JPEG, TIFF, BMP, DOC, DOCX, PPT, PPTX, XLS, XLSX (20+ total) |
| **Support / on-prem** | `support@unsiloed.ai`; self-hosted on AWS/Azure/GCP + air-gapped available |

**Status vocabulary is NOT uniform across endpoints — this bites people:**

| Endpoint | Terminal success | Terminal failure | In-progress |
| --- | --- | --- | --- |
| `/parse` (v1/v2) | `Succeeded` | `Failed` | `Starting`, `Processing` (v2 also `AwaitingUpload`, `Queued`) |
| `/v3/parse` | `done` | `failed` | `queued`, `running` |
| `/v2/extract` | `completed` / `COMPLETED` | `failed` / `FAILED` | `queued`, `processing` |
| `/classify` | `completed` | `failed` | `processing` |
| `/splitter` | `completed` | `failed` | `processing` |

**Pricing:** usage-based, pay-as-you-go credits; quota tracked per org. Parse cost is metered in **pages** (`credit_used` = pages deducted). Contact `support@unsiloed.ai` for enterprise pricing. Check live quota via `GET /org/get_usage`.

---

# 1. Parse Document (the workhorse) — `POST /parse`

`POST /parse` → segment PDFs, images, and Office files into meaningful sections (text, tables, figures, formulas, OCR) and return ordered **Markdown chunks with bounding boxes**. This is what feeds Moss.

**Flow:** `POST /parse` (file or url) → returns `job_id` (status `Starting`) → poll `GET /parse/{job_id}` → status `Succeeded` includes the full `chunks[]` array.

### Request (multipart form fields)

You must provide **either** `file` **or** `url` (not both).

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `file` | file | — | The document. Required if `url` not given. |
| `url` | string | — | Presigned/public URL to fetch. Required if `file` not given. |
| `use_high_resolution` | boolean | `true` | Better OCR on bad scans. **Latency +2–3s/page.** |
| `layout_analysis` | string | `smart_layout_detection` | `smart_layout_detection` (bbox-based, best chunking) / `page_by_page` (1 segment/page, fastest) / `advanced_layout_detection` (VLM, 14 element types incl. `KeyValuePair`, `Signature`, `Seal`). |
| `ocr_strategy` | string | `auto_detection` | `auto_detection` (OCR only where needed) / `force_ocr` (whole doc). |
| `ocr_engine` | string | `UnsiloedBeta` | `UnsiloedBeta` (rotated/warped text) / `UnsiloedHawk` (complex layouts) / `UnsiloedStorm` (50+ languages, enterprise). |
| `agentic_ocr` | string | empty (off) | `standard` or `advanced` — per-segment re-OCR after layout detection. |
| `extract_strikethrough` | boolean | `false` | Preserve strikethrough in HTML/MD. |
| `merge_tables` | boolean | `false` | Stitch tables spanning page breaks by matching headers/columns. |
| `validate_segments` | string (JSON array) | `[]` | VLM re-checks misclassified segments, e.g. `["Table","Formula","Picture"]`. |
| `segment_filter` | string | `all` | Comma-separated types to KEEP: `table`, `picture`, `formula`, `text`, `sectionheader`, `title`, `listitem`, `caption`, `footnote`, `pageheader`, `pagefooter`. e.g. `"table,picture"`. |
| `xml_citation` | boolean | `false` | Extract + hyperlink bibliography citations (PDF only). |
| `output_fields` | string (JSON) | all `true` | Toggle fields to shrink response: `html`, `markdown`, `ocr`, `image`, `content`, `bbox`, `confidence`, `embed`. |
| `segment_analysis` / `segment_processing` | string (JSON) | `{}` | Per-segment-type model + html/markdown strategy (see below). `segment_processing` wins if both set. |
| `pages` | string | all | `"1-5"`, `"2,4,6"`, or `"[1,3,5]"`. |
| `segment_type_naming` | string | `Unsiloed` | `Unsiloed` (`PageHeader`, `ListItem`, `Picture`) or `Other` (`Header`, `List Item`, `Figure`). |
| `extract_colors` | boolean | `false` | Carry PDF text color into OCR results. |
| `extract_links` | boolean | `false` | Attach hyperlink URLs from PDF annotations. |
| `export_format` | string (JSON array) | — | Generate export files after parse: `["docx"]`, `["markdown"]`, `["json"]`. Must be JSON-encoded string. |
| `error_handling` | string | `Continue` | `Continue` (skip bad pages) or `Fail` (abort on first error). |
| `expires_in` | integer | plan default | Seconds until task + output deleted. |

**`segment_analysis` object** (per type — Table / Picture / Formula):
```json
{
  "Table":   {"html": "VLM", "markdown": "VLM", "model_id": "us_table_v2"},
  "Picture": {"html": "VLM", "markdown": "VLM", "model_id": "nova"},
  "Formula": {"html": "Auto", "markdown": "VLM", "model_id": "nova"}
}
```
- `html`/`markdown`: `"VLM"` or `"Auto"`.
- Table `model_id`: `astra`, `us_table_v1`, `us_table_v2` (also `astra_v2`/`astra_v3` per Processing Modes).
- Picture/Formula `model_id`: `nova`, `luna`, `sol`.
- `use_table_ocr` (Table only): advanced OCR for bordered cells/gridlines.
- `vlm`: custom prompt string to steer the VLM per segment type.

### Submit example

```bash
curl -X POST 'https://prod.visionapi.unsiloed.ai/parse' \
  -H 'accept: application/json' \
  -H 'api-key: your-api-key' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@document.pdf;type=application/pdf' \
  -F 'use_high_resolution=true' \
  -F 'layout_analysis=smart_layout_detection' \
  -F 'ocr_strategy=auto_detection' \
  -F 'ocr_engine=UnsiloedHawk' \
  -F 'merge_tables=true' \
  -F 'segment_filter=all' \
  -F 'validate_segments=["Table","Picture","Formula"]' \
  -F 'segment_analysis={"Table":{"html":"VLM","markdown":"VLM","extended_context":true,"crop_image":"All","model_id":"us_table_v2"}}'
# Use a presigned URL instead of file:  -F 'url=https://bucket.s3.amazonaws.com/doc.pdf?signature=...'
```

### Submit response

```json
{
  "job_id": "e77a5c42-4dc1-44d0-a30e-ed191e8a8908",
  "status": "Starting",
  "file_name": "document.pdf",
  "created_at": "2025-07-18T10:42:10.545832520Z",
  "message": "Task created successfully. Use GET /parse/{job_id} to check status and retrieve results.",
  "credit_used": 5,
  "quota_remaining": 23695,
  "merge_tables": false
}
```

### Get result — `GET /parse/{job_id}`

Query params: `base64_urls` (bool, default `false` — return base64 images instead of S3 URLs), `include_chunks` (bool, default `true`), `output_file` (bool, default `false` — return presigned URL to raw output JSON instead of inlining), **`include_url`** (bool, default `false` — see Gotchas; without it `pdf_url`/`file_url`/segment `image`/`exports` come back `null`).

```bash
curl 'https://prod.visionapi.unsiloed.ai/parse/{job_id}?include_url=true' \
  -H 'api-key: your-api-key'
```

**Succeeded response shape** (trimmed; this is the canonical structure you feed Moss):

```json
{
  "job_id": "a0f51f79-6eb8-412a-9afa-924ddfbf9578",
  "status": "Succeeded",
  "message": "Task succeeded",
  "file_name": "document.pdf",
  "file_type": "application/pdf",
  "page_count": 10,
  "total_chunks": 25,
  "credit_used": 10,
  "created_at": "...", "started_at": "...", "finished_at": "...",
  "pdf_url": "https://s3.us-east-1.amazonaws.com/...",
  "exports": { "docx": "https://s3.../output.docx?..." },
  "configuration": { "layout_analysis": "smart_layout_detection", "ocr_engine": "UnsiloedHawk", "...": "..." },
  "chunks": [
    {
      "chunk_id": "6b2eca3a-d14f-4164-ba9a-0a3a58fcaf45",
      "chunk_length": 117,
      "embed": "## Q1 2024 Sales Report\nThe following table summarises...",
      "segments": [
        {
          "segment_id": "034a37e7-6e4b-45dd-802c-e648d6c16498",
          "segment_type": "SectionHeader",
          "content": "Q1 2024 Sales Report",
          "markdown": "## Q1 2024 Sales Report",
          "html": "<h2>Q1 2024 Sales Report</h2>",
          "bbox": { "left": 427.6, "top": 67.8, "width": 344.7, "height": 36.5 },
          "page_number": 1, "page_width": 1191.0, "page_height": 1684.0,
          "confidence": 0.35,
          "image": "https://s3.us-east-1.amazonaws.com/...",
          "ocr": [ { "text": "Q1", "bbox": {"left":5.4,"top":4.1,"width":35.6,"height":22.7}, "confidence": null } ]
        }
      ]
    }
  ]
}
```

**The fields you'll actually use:**
- **`chunks[].embed`** → the chunk rolled up as Markdown, **ready to embed / send to Moss**. This is the single most important field in the whole API.
- `chunks[].segments[]` → layout primitives: `segment_type`, `bbox`, `page_number`, `markdown`/`html`/`content`, `image` (cropped signed URL), `ocr[]` (word-level boxes for source highlighting), `confidence` (0–1, debug signal not a hard threshold).
- `total_chunks`, `page_count`, `credit_used`, `status`.

**Segment types:** `Title` (`#`/`<h1>`), `SectionHeader` (`##`/`<h2>`), `Text`, `Table`, `Picture`, `Caption`, `Formula`, `Footnote`, `ListItem`, `PageHeader`, `PageFooter`, plus `KeyValuePair`, `Signature`, `Seal` (only under `advanced_layout_detection`).

### Processing Modes (preset bundles)

Instead of tuning knobs individually, apply one of three presets:

| Parameter | Fast | Accurate | Agentic |
| --- | --- | --- | --- |
| `ocr_engine` | `UnsiloedStorm` | `UnsiloedBeta` | `UnsiloedBeta` |
| `segment_processing.Table.html` | `VLM` | `VLM` | `VLM` |
| `segment_processing.Table.model_id` | `astra_v2` | `astra_v3` | `astra_v3` |
| `agentic_ocr` | `null` | `null` | `advanced` |
| `merge_tables` | `false` | `true` | `false` |

For a hackathon: **Fast** for live demos (speed), **Accurate** for the pre-indexed corpus you parse once. Agentic only for a single hero document where fidelity is the wow-factor.

---

# 2. Parse v2 (Presigned Upload) — `POST /v2/parse/upload`

Same parse engine, but decouples upload from job creation for **large files / high throughput**. The API server is never in the file transfer path.

1. `POST /v2/parse/upload` with your config → returns a short-lived presigned `PUT` URL + `job_id`. Status starts `AwaitingUpload`.
2. `PUT` the file directly to that URL.
3. Upload completion auto-enqueues the job (→ `Queued` → `Processing` → `Succeeded`/`Failed`).
4. Poll `GET /parse/{job_id}` — **same result endpoint as v1**.

Use this when parsing a 400-page manual or many docs in parallel.

---

# 3. Parse v3 (markdown-only, simplest) — `POST /v3/parse`

The newest, deliberately minimal surface: **PDF in → Markdown out**, no layout/OCR/segment knobs, no segment tree. The pipeline picks the best model per page. **Different auth + base URL + key.**

- **Base URL:** `https://prod.visionapi.unsiloed.ai/v3/parse`
- **Auth:** `X-API-Key: <key>` (v3 keys are SEPARATE from v1/v2 — email `aman@unsiloed.ai`).
- **Limits:** 100 requests/day, 2 RPS per key. Per-key isolation (others' `job_id`/`file_id` → 404). **24-hour artifact retention.**
- **Status vocab:** `queued` → `running` → `done`/`failed`.

### Four routes

| Route | Use it for |
| --- | --- |
| `POST /v3/parse` | Submit a single PDF (3 body shapes) |
| `POST /v3/parse/upload` | Mint presigned PUT URL for big PDFs (up to 50MB) |
| `POST /v3/parse/batch` | tar/tar.gz/zip archive of PDFs in one job |
| `GET /v3/parse/{job_id}` | Poll + retrieve markdown |

### Three body shapes for `POST /v3/parse`

```bash
# Shape 1 — inline multipart (PDFs up to ~3MB)
curl -X POST -H "X-API-Key: <key>" -F file=@input.pdf \
  https://prod.visionapi.unsiloed.ai/v3/parse

# Shape 2 — caller-hosted URL (up to 50MB; https:// or s3://; SSRF-guarded)
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/your-paper.pdf"}' \
  https://prod.visionapi.unsiloed.ai/v3/parse

# Shape 3 — file_id from presigned upload (private large files)
curl -X POST -H "X-API-Key: <key>" -H "Content-Type: application/json" \
  -d '{"file_id":"<file_id>"}' \
  https://prod.visionapi.unsiloed.ai/v3/parse
```
Optional query param `pages` (`"1-5"`, `"1,3,5"`) restricts OCR to a page subset.

### Presigned 3-call flow (big private PDF)

```bash
export API=https://prod.visionapi.unsiloed.ai/v3/parse
export KEY=<your-api-key>
UP=$(curl -s -X POST -H "X-API-Key: $KEY" $API/upload)   # -> file_id + upload_url (1h expiry, max 50MB)
FILE_ID=$(jq -r .file_id <<< "$UP")
UPLOAD_URL=$(jq -r .upload_url <<< "$UP")
curl -X PUT -H "Content-Type: application/pdf" --upload-file big.pdf "$UPLOAD_URL"
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d "{\"file_id\":\"$FILE_ID\"}" $API
```

### Poll + result

```bash
curl -H "X-API-Key: <key>" https://prod.visionapi.unsiloed.ai/v3/parse/<job_id>
# add ?format=markdown to get raw text/markdown instead of JSON when status=done
```

**Single-PDF done** returns `pages[]` (each `{page, markdown}`); **batch done** returns `documents[]` (each `{pdf, page_count, pages[]}` or `{error}`):

```json
{
  "job_id": "5eb3493042f84af5860531df5b18c56b",
  "status": "done",
  "file_name": "input.pdf",
  "page_count": 3,
  "pages": [
    { "page": 1, "markdown": "..." },
    { "page": 2, "markdown": "..." },
    { "page": 3, "markdown": "..." }
  ]
}
```

> If the JSON would exceed API Gateway's 10MB cap, you get `{job_id, status:"done", result_url}` — fetch `result_url` (presigned S3 GET) for the identical JSON.

**v3 errors worth knowing:** `401` missing/invalid key; `403` key not propagated yet (retry after ~1 min); `404` job/file belongs to another key (isolation); `413` multipart too big (switch to shape 2/3); `429` quota/rate; `400` invalid url (SSRF guard).

**v3 vs v1/v2:** use **v3** when you just want clean Markdown fast and don't need bboxes. Use **v1/v2** when you need segments, bounding boxes, per-segment models, table merging, citations, or `output_fields` control. For a Moss demo, **v1's `chunks[].embed` is usually the best fit** (already chunked); v3's `pages[].markdown` is per-page (you chunk yourself).

---

# 4. Extract Structured Data — `POST /v2/extract`

Hand it a **JSON Schema**, get back **typed fields** with a **confidence score on every value** and optional **bounding-box citations**. Use this when you already know the fields that matter (invoice line items, contract terms, KYC fields, lab values).

### Request (multipart form fields)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `pdf_file` | file | — | The PDF. Max 100MB. `pdf_file` or `file_url` required. |
| `file_url` | string | — | URL to PDF. |
| `schema_data` | string (JSON Schema) | — | Strict-mode JSON Schema (see rules below). |
| `model` | string | `gamma` | Tiers: `alpha`, `beta`, `gamma` (recommended), `delta`. |
| `enable_citations` | boolean | `false` | Adds `bboxes` (location) to each field for highlighting/audit. |

### Submit

```bash
curl -X POST "https://prod.visionapi.unsiloed.ai/v2/extract" \
  -H "accept: application/json" -H "api-key: your-api-key" \
  -H "Content-Type: multipart/form-data" \
  -F "pdf_file=@document.pdf;type=application/pdf" \
  -F "schema_data={\"type\":\"object\",\"properties\":{\"title\":{\"type\":\"string\",\"description\":\"Document title\"},\"date\":{\"type\":\"string\",\"description\":\"Document date\"}},\"required\":[\"title\",\"date\"],\"additionalProperties\":false}"
```
Submit response: `{"job_id": "...", "status": "queued", "message": "PDF citation processing started", "quota_remaining": 48988}`.

### Get result — `GET /extract/{job_id}`

Poll until `status` is `completed`/`COMPLETED`, then read `result`. **Each extracted field is an object** `{value, score, page_no, bboxes?}`:

```json
{
  "invoice_number": {
    "value": "INV-2025-001",
    "page_no": 1,
    "score": 0.97,
    "bboxes": [ { "bbox": [139, 209, 280, 222], "text": "INV-2025-001",
                  "confidence": 0.95, "page_width": 595.0, "page_height": 842.0 } ]
  }
}
```
- Bbox coords: `[left, top, right, bottom]` in PDF point space, origin top-left (A4 = 595×842 pt). `page_width`/`page_height` included for scaling.
- Without `enable_citations` you get just `{value, score, page_no}`.
- For **array fields**, `value` is an array of objects, each with its own `bboxes` + `page_no`.
- `min_confidence_score` at top level = lowest field confidence (great gate for human-review routing).

**Confidence bands** (from docs): 0.9–1.0 very high, 0.8–0.9 high, 0.7–0.8 review for critical apps, 0.6–0.7 should review, <0.6 likely needs manual verification.

### JSON Schema rules (strict mode — applies at EVERY object level)

1. Root must be `{"type":"object"}` (no top-level arrays/primitives).
2. Every field needs a `type` and should have a clear `description` (the description is your prompt — be specific, include units).
3. List mandatory fields in `required`.
4. **Set `"additionalProperties": false` at root AND inside every nested object AND every array's `items`.**

Supported types: `string`, `number`, `integer`, `boolean`, `array` (needs `items`), `object` (needs `properties`), `null` (combine like `["string","null"]`).

Invoice line-items pattern (arrays of objects):
```json
{
  "type": "object",
  "properties": {
    "line_items": {
      "type": "array",
      "description": "Invoice line items",
      "items": {
        "type": "object",
        "properties": {
          "description": {"type": "string", "description": "Item description"},
          "quantity":    {"type": "number", "description": "Quantity"},
          "price":       {"type": "number", "description": "Unit price"}
        },
        "required": ["description", "quantity", "price"],
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```
> No-code option: the dashboard at `app.unsiloed.ai/playground/Extractor` has a schema builder (Manual + Auto-Suggest: describe fields + upload a sample → it generates the schema).

---

# 5. Classify Document — `POST /classify`

PDF + candidate categories → overall classification + per-page predictions, each with a confidence score. Use at the **front of an ingestion pipeline** to route docs to the right handler.

```bash
curl -X POST "https://prod.visionapi.unsiloed.ai/classify" \
  -H "api-key: your-api-key" \
  -F "pdf_file=@document.pdf" \
  -F 'categories=[{"name":"invoice","description":"Financial invoices"},{"name":"contract","description":"Legal contracts"},{"name":"receipt"}]'
```
- Field `pdf_file` (or `file_url`) + `categories` (JSON-stringified array of `{name, description?}`). Categories are the model's entire vocabulary — make names distinct.
- Submit response: `{"job_id": "...", "status": "processing", "message": "Classification started", "quota_remaining": 450}` (HTTP 202).
- Poll `GET /classify/{job_id}` until `status: "completed"`:

```json
{
  "job_id": "97ba5215-...",
  "status": "completed",
  "progress": "Classification completed",
  "error": null,
  "result": {
    "success": true,
    "classification": "Invoice",
    "confidence": 0.9999994487765023,
    "total_pages": 1,
    "processed_pages": 1,
    "page_results": [
      { "page": 1, "success": true, "classification": "Invoice", "raw_result": "Invoice", "confidence": 0.9999994 }
    ]
  }
}
```

---

# 6. Split Document — `POST /splitter`

One bundled/scanned PDF containing several documents → one labeled PDF per detected document. Ideal for mail rooms, AP scans, patient intake batches.

```bash
curl -X POST "https://prod.visionapi.unsiloed.ai/splitter" \
  -H "api-key: your-api-key" \
  -F "file=@mixed_documents.pdf" \
  -F 'categories=[{"name":"invoice","description":"Business invoices with itemized charges"},{"name":"contract","description":"Legal agreements and binding documents"}]'
```
- Fields `file` (or `file_url`) + `categories` (JSON array of `{name, description?}`).
- Poll `GET /splitter/{job_id}` until `status: "completed"`. The result's `result.files[]` (also surfaced as top-level `files[]` in the API-reference shape) each have `name`, `fileId`, `type`, `path`, `full_path` (download URL), `confidence_score`:

```json
{
  "success": true,
  "message": "Successfully split PDF into 2 files",
  "files": [
    { "name": "invoice.pdf", "fileId": "d079...", "type": "file", "path": "invoice.pdf",
      "full_path": "https://...supabase.co/storage/v1/object/public/files/..._invoice.pdf?",
      "confidence_score": 0.8 },
    { "name": "contract.pdf", "fileId": "3206...", "type": "file", "path": "contract.pdf",
      "full_path": "https://...supabase.co/.../_contract.pdf?", "confidence_score": 0.8 }
  ]
}
```
Download each split file from `full_path`, then run it through `/parse` for indexing. `parameters` echoes `classes`, `page_count`, `enable_reordering`, `category_descriptions`.

---

# 7. Org Usage — `GET /org/get_usage`

```bash
curl "https://prod.visionapi.unsiloed.ai/org/get_usage" -H "api-key: your-api-key"
```
Returns `org_id`, `org_name`, `current_usage`, `usage_limit`, `remaining_quota` (= limit − usage), `last_billed_date` (resets every 30 days). Call this before a demo to confirm you have credits.

---

# 8. Claude Integration (drop-in Anthropic tool-use schemas)

Unsiloed ships ready-to-paste Anthropic tool definitions so Claude can parse/extract/classify/split autonomously. **All tools accept a public URL** (Claude can't upload binaries) and submit async jobs; a `unsiloed_get_job_result` tool polls. Install: `pip install anthropic requests` (Python) or `npm install @anthropic-ai/sdk`.

Tools provided: `unsiloed_parse_document`, `unsiloed_extract_data`, `unsiloed_classify_document`, `unsiloed_split_document`, `unsiloed_get_job_result(job_type, job_id)`. The executor just maps tool calls to the REST endpoints with header `{"api-key": UNSILOED_API_KEY}` against `https://prod.visionapi.unsiloed.ai`. This is the fastest way to wire Unsiloed into an LLM-driven agent loop.

---

# Hackathon recipes (composed with Moss + sponsors)

### Recipe A — "Drop a 400-page manual → talk to it" (Support track, the flagship)
**Stack:** Unsiloed → Moss → LiveKit (+ MiniMax TTS, TrueFoundry gateway, AWS host).
1. **Ingest (do once, pre-demo):** Big PDF → `POST /v2/parse/upload` (presigned, handles size) with `merge_tables=true`, `ocr_engine=UnsiloedHawk`. Poll `GET /parse/{job_id}`.
2. **Chunk → index:** Iterate `result["chunks"]`; for each, push `chunk["embed"]` (Markdown) into a **Moss index**, storing `{chunk_id, page_number, bbox}` as metadata for citations.
3. **Voice loop:** LiveKit agent does STT → query Moss (sub-10ms) → stuff top-k `embed` chunks into the LLM prompt (routed through **TrueFoundry**) → answer → **MiniMax** TTS speaks it, citing the page number.
4. **Wow moment:** Bot says "per page 212 of the manual, …" and your UI highlights the exact `bbox`. Host everything on **AWS**.

```python
# Glue: parse -> push embed chunks to Moss
for chunk in parse_result["chunks"]:
    moss.upsert(
        id=chunk["chunk_id"],
        text=chunk["embed"],                       # embedding-ready Markdown
        metadata={"page": chunk["segments"][0]["page_number"]} if chunk["segments"] else {},
    )
```

### Recipe B — "Mixed inbox → routed knowledge" (Support / Co-Pilot)
A support inbox dumps mixed PDFs. `POST /splitter` to break a bundle into invoice/contract/receipt, then `POST /classify` to tag stragglers, then `/parse` each → Moss. The voice agent now answers "what's the warranty on order #..." by retrieving only the contract chunks. Split + classify = automatic, accurate routing with confidence scores.

### Recipe C — "Live lead qualification from an RFP" (Lead Gen)
Caller emails an RFP/spec PDF. `POST /v2/extract` with a schema for `{budget, timeline, decision_maker, requirements[]}` + `enable_citations=true`. The LiveKit agent reads back the extracted fields with confidence; anything with `min_confidence_score < 0.7` it asks the caller to confirm out loud. Structured JSON → your CRM.

### Recipe D — "Ambient contract co-pilot" (Co-Pilot track)
During a sales/legal call, the ambient agent listens (LiveKit), and when a clause is mentioned, it queries a Moss index built from `/parse` of the contract. Because each chunk carries `segments[].bbox` + `page_number`, the co-pilot surfaces a screenshot crop (use `segments[].image` signed URL) of the exact clause on screen while the call continues.

### Recipe E — "Financials-only fast index"
For data-heavy docs, parse with `segment_filter=table,picture`, `merge_tables=true`, `validate_segments=["Table","Picture"]`, and `output_fields={"html":true,"markdown":true,"ocr":false,"image":false,"content":true,"bbox":false}` to shrink the payload. You get clean multi-page-stitched tables as Markdown → Moss → "what was Q3 East revenue?" answered by voice.

### Recipe F — "Claude-orchestrated ingest agent"
Use the provided Anthropic tool schemas so Claude itself decides: classify the incoming URL, split if it's a bundle, parse each piece, extract key fields, and report — all via `unsiloed_*` tools. Minimal glue, maximal demo narrative ("the agent ingested the whole folder by itself").

---

# Gotchas / latency notes / what to demo

**Latency (plan your demo around this):**
- Parsing is **async and not instant.** Quickstarts poll every 5s with a **5-minute timeout**; a 10-page doc in the example took ~6 minutes (`created_at` 06:51 → `finished_at` 06:57). **Parse and index your corpus BEFORE the demo, not live.** Only the Moss retrieval + voice turn should happen live.
- `use_high_resolution=true` adds **+2–3s/page**; `validate_segments` adds **+1–2s/page**. For a live parse on stage, use **Fast mode** (`page_by_page` or `UnsiloedStorm`, high-res off).
- v3 is rate-limited to **2 RPS / 100 req/day per key** — fine for a demo, not for bulk. v3 artifacts are **deleted after 24h** — pull results same-session.

**Auth/config traps:**
- **Two different auth headers:** `api-key` for v1/v2/extract/classify/split; **`X-API-Key` for v3** (and v3 needs a separately-issued key). Don't cross them.
- **`include_url=true` is required** on `GET /parse/{job_id}` or `pdf_url`, `file_url`, `exports`, and segment `image` come back `null` (privacy default). If your highlight UI shows blank crops, this is why.
- **Status strings differ per endpoint** (`Succeeded` vs `done` vs `completed`). A poller hardcoded to one will hang forever on another. (See the table above.)
- **`file` XOR `url`** on parse — sending both fails. `pdf_file` (extract/classify) vs `file` (parse/split) field-name difference bites copy-paste.
- Multipart JSON fields (`export_format`, `validate_segments`, `segment_analysis`, `categories`, `schema_data`) must be **JSON-encoded strings**, e.g. `export_format=["docx"]` not `export_format=docx`.
- Extract schema strict mode: **`additionalProperties: false` at every level** or it rejects. Root must be an object.

**Rate/quota errors:** `402` insufficient page credits; `429` usage cap (`Usage limit exceeded`, no Retry-After) or rate limit (60 req/60s sliding window — `Rate limit exceeded`); `503` queue at capacity (honor `Retry-After`). Parse error bodies are **plain text, not JSON** — check status code before calling `.json()`.

**What to demo (judging is for fundable voice products):**
- The end-to-end "I dropped a real customer PDF and asked it out loud, and it answered with a page citation" loop — that's the retrieval-is-the-bottleneck thesis made tangible.
- Show a **bbox highlight** of the source (the crop overlay) — proves the answer is grounded, not hallucinated. Unsiloed's `bbox` + `page_number` + `confidence` make this trivial.
- Show **confidence-gated human-in-the-loop** for extraction (low `min_confidence_score` → the voice agent asks to confirm). Reads as production-ready.
- Mention scale: async + presigned upload + on-prem = enterprise-credible.

---

# Cheat-sheet — the 10 things you'll copy-paste at 2am

```bash
# 0. Env
export UNSILOED_API_KEY="your-api-key"
BASE=https://prod.visionapi.unsiloed.ai

# 1. PARSE a PDF (-> job_id)
curl -sX POST "$BASE/parse" -H "api-key: $UNSILOED_API_KEY" -F "file=@document.pdf"

# 2. POLL parse (status: Starting/Processing -> Succeeded). include_url to get image/pdf URLs
curl -s "$BASE/parse/$JOB_ID?include_url=true" -H "api-key: $UNSILOED_API_KEY"

# 3. Parse from a URL instead of upload
curl -sX POST "$BASE/parse" -H "api-key: $UNSILOED_API_KEY" \
  -F "url=https://bucket.s3.amazonaws.com/doc.pdf?sig=..." -F "merge_tables=true"

# 4. EXTRACT typed fields with a schema (+ citations)
curl -sX POST "$BASE/v2/extract" -H "api-key: $UNSILOED_API_KEY" \
  -F "pdf_file=@document.pdf" -F "enable_citations=true" \
  -F 'schema_data={"type":"object","properties":{"total":{"type":"number","description":"Total due USD"}},"required":["total"],"additionalProperties":false}'
# poll: curl -s "$BASE/extract/$JOB_ID" -H "api-key: $UNSILOED_API_KEY"   (status -> completed)

# 5. CLASSIFY into categories
curl -sX POST "$BASE/classify" -H "api-key: $UNSILOED_API_KEY" -F "pdf_file=@document.pdf" \
  -F 'categories=[{"name":"invoice"},{"name":"contract"}]'
# poll: curl -s "$BASE/classify/$JOB_ID" -H "api-key: $UNSILOED_API_KEY"   (status -> completed)

# 6. SPLIT a bundled PDF
curl -sX POST "$BASE/splitter" -H "api-key: $UNSILOED_API_KEY" -F "file=@bundle.pdf" \
  -F 'categories=[{"name":"invoice"},{"name":"contract"}]'
# poll: curl -s "$BASE/splitter/$JOB_ID" -H "api-key: $UNSILOED_API_KEY"   (status -> completed)

# 7. v3 markdown-only (NOTE: X-API-Key header, /v3 base, separate key)
curl -sX POST "$BASE/v3/parse" -H "X-API-Key: $V3_KEY" -F file=@input.pdf
curl -s "$BASE/v3/parse/$JOB_ID?format=markdown" -H "X-API-Key: $V3_KEY"   # status -> done

# 8. v2 presigned upload for BIG files
curl -sX POST "$BASE/v2/parse/upload" -H "api-key: $UNSILOED_API_KEY"  # -> presigned PUT url + job_id
#   then PUT the file to that url, then poll $BASE/parse/$JOB_ID

# 9. CHECK quota before demoing
curl -s "$BASE/org/get_usage" -H "api-key: $UNSILOED_API_KEY"

# 10. THE GLUE: parse result -> Moss index (Python)
#   for chunk in result["chunks"]: moss.upsert(id=chunk["chunk_id"], text=chunk["embed"],
#       metadata={"page": chunk["segments"][0]["page_number"]})
```

**Mode presets** (parse `data` fields): Fast `ocr_engine=UnsiloedStorm, merge_tables=false` · Accurate `ocr_engine=UnsiloedBeta, merge_tables=true` · Agentic `agentic_ocr=advanced`.

**Field that matters most:** `chunks[].embed` — Markdown, already chunked, drop straight into Moss.
