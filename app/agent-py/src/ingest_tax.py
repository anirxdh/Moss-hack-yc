"""Parse a financial PDF with Unsiloed and (re)build the Moss knowledge index from it.

The V1 ingest pipeline for the AI CPA:
  PDF --(Unsiloed /parse)--> Markdown chunks --(Moss create_index)--> searchable RAG.

Usage:
    uv --directory agent-py run src/ingest_tax.py ["/abs/path/to/doc.pdf"]

Reads UNSILOED_API_KEY, MOSS_PROJECT_ID, MOSS_PROJECT_KEY (and optional
MOSS_INDEX_NAME / MOSS_MODEL_ID) from agent-py/.env.local.

Privacy: this script NEVER prints document text (it may contain SSN/income).
It prints only counts, page numbers, job ids, and latency.
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from moss import DocumentInfo, MossClient, QueryOptions

AGENT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = AGENT_DIR / ".env.local"
load_dotenv(ENV_PATH)

UNSILOED_BASE = "https://prod.visionapi.unsiloed.ai"
# Tax PDF path — override with TAX_PDF_PATH (or pass as the first CLI arg).
# Kept generic so no personal filename is committed to the repo.
DEFAULT_PDF = os.getenv("TAX_PDF_PATH", str(AGENT_DIR / "data" / "tax_return.pdf"))
MODEL_ID = os.getenv("MOSS_MODEL_ID", "moss-minilm")
INDEX_NAME = os.getenv("MOSS_INDEX_NAME", "knowledge")
# The shared `knowledge` index is multi-user; this return is tagged with a
# user_id (option B). Default matches the agent's console fallback so a local
# demo "just works". The browser passes a real per-user id via dispatch metadata
# (set DEMO_USER_ID in the frontend to pin it to this value for a demo).
DEFAULT_INGEST_USER = "user_1"
POLL_DEADLINE_S = 1800
POLL_EVERY_S = 5


def submit_parse(pdf_path: str, api_key: str) -> str:
    """POST the PDF to Unsiloed /parse and return the job_id."""
    with open(pdf_path, "rb") as fh:
        files = {"file": (Path(pdf_path).name, fh, "application/pdf")}
        # Clean digital PDF -> skip high-res OCR for speed; auto OCR fills any gaps.
        data = {
            "use_high_resolution": "false",
            "layout_analysis": "smart_layout_detection",
            "ocr_strategy": "auto_detection",
            "merge_tables": "true",
        }
        resp = requests.post(
            f"{UNSILOED_BASE}/parse",
            headers={"api-key": api_key, "accept": "application/json"},
            files=files,
            data=data,
            timeout=180,
        )
    resp.raise_for_status()
    job = resp.json()
    job_id = job.get("job_id")
    print(
        f"  submitted: job_id={job_id} status={job.get('status')} "
        f"credit_used={job.get('credit_used')} quota_remaining={job.get('quota_remaining')}"
    )
    if not job_id:
        raise RuntimeError(f"No job_id in submit response: {job}")
    return job_id


def poll_job(job_id: str, api_key: str) -> list[dict]:
    """Poll GET /parse/{job_id} until done, return chunks[]."""
    deadline = time.time() + POLL_DEADLINE_S
    last = None
    while time.time() < deadline:
        g = requests.get(
            f"{UNSILOED_BASE}/parse/{job_id}",
            headers={"api-key": api_key},
            params={"include_chunks": "true"},
            timeout=90,
        )
        g.raise_for_status()
        res = g.json()
        status = (res.get("status") or "").lower()
        if status != last:
            print(f"  ...status={res.get('status')} ({res.get('message')})")
            last = status
        if status in ("succeeded", "done", "completed"):
            print(
                f"  parse done: page_count={res.get('page_count')} "
                f"total_chunks={res.get('total_chunks')} credit_used={res.get('credit_used')}"
            )
            return res.get("chunks") or []
        if status in ("failed",):
            raise RuntimeError(res.get("message", "parse job failed"))
        time.sleep(POLL_EVERY_S)
    raise TimeoutError(f"parse polling timed out after {POLL_DEADLINE_S}s")


def chunks_to_docs(
    chunks: list[dict], user_id: str, doc_id: str, source: str
) -> list[DocumentInfo]:
    """Turn Unsiloed chunks into Moss documents for a specific user + document.

    The `knowledge` index is shared across users (option B), so every chunk is
    tagged with `user_id` and given a user+document-namespaced id
    (`{user_id}-{doc_id}-chunk-{i}`).

    Namespacing by `doc_id` (the upload slot — e.g. "w2", "1099int", or
    "tax_return" for the CLI) is what lets ONE user upload MANY documents: each
    upload writes its own `{user_id}-{doc_id}-chunk-*` ids, so a second upload no
    longer upserts over the first's `{user_id}-chunk-*` ids and silently destroys
    it. The agent's search_knowledge filters by `user_id`, so users never see
    each other's returns; re-uploading the SAME slot upserts (replaces) just that
    document.
    """
    docs: list[DocumentInfo] = []
    for i, ch in enumerate(chunks):
        text = (ch.get("embed") or "").strip()
        if not text:
            segs = ch.get("segments") or []
            text = "\n".join(
                (s.get("markdown") or s.get("content") or "").strip() for s in segs
            ).strip()
        if not text:
            continue
        segs = ch.get("segments") or []
        page = next(
            (s.get("page_number") for s in segs if s.get("page_number") is not None),
            None,
        )
        types = sorted({s["segment_type"] for s in segs if s.get("segment_type")})
        meta = {
            "user_id": user_id,
            "doc_id": doc_id,
            "source": source,
            "chunk_index": str(i),
        }
        if ch.get("chunk_id"):
            meta["chunk_id"] = str(ch["chunk_id"])
        if page is not None:
            meta["page"] = str(page)
        if types:
            meta["types"] = ",".join(types)[:200]
        docs.append(
            DocumentInfo(id=f"{user_id}-{doc_id}-chunk-{i}", text=text, metadata=meta)
        )
    return docs


async def ingest_pdf(
    pdf_path: str,
    user_id: str,
    doc_id: str,
    source: str,
    *,
    resume_job: str | None = None,
) -> dict:
    """Parse one PDF with Unsiloed and upsert its chunks into the shared Moss
    `knowledge` index, namespaced by (``user_id``, ``doc_id``).

    This is the reusable core shared by the CLI (``main``) and the FastAPI
    ingest service (``src/ingest_service.py``). It raises on any unrecoverable
    condition (missing creds, index not found, empty parse) so every caller can
    surface a clear error instead of a silent no-op.

    Returns a small result dict of COUNTS only — it never returns or logs
    document text (which may contain SSN / income).

    Pipeline:
        PDF --(Unsiloed /parse)--> chunks --(chunks_to_docs)--> Moss add_docs
    """
    api_key = os.getenv("UNSILOED_API_KEY")
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    if not api_key:
        raise RuntimeError("UNSILOED_API_KEY missing from agent-py/.env.local")
    if not (project_id and project_key):
        raise RuntimeError("MOSS_PROJECT_ID / MOSS_PROJECT_KEY missing")
    if not Path(pdf_path).exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    if resume_job:
        print(f"[1/3] Resuming existing Unsiloed job: {resume_job}")
        chunks = poll_job(resume_job, api_key)
    else:
        print(f"[1/3] Parsing with Unsiloed: {Path(pdf_path).name}")
        job_id = submit_parse(pdf_path, api_key)
        chunks = poll_job(job_id, api_key)

    docs = chunks_to_docs(chunks, user_id, doc_id, source)
    print(
        f"[2/3] Prepared {len(docs)} Moss docs for user '{user_id}' "
        f"doc '{doc_id}' from {len(chunks)} chunks."
    )
    if not docs:
        raise RuntimeError("No usable text parsed from the PDF.")

    client = MossClient(project_id, project_key)
    # Option B: the `knowledge` index is SHARED across users. Add only THIS
    # user's docs (user+doc-namespaced ids upsert their own chunks) so neither
    # other users' nor this user's OTHER documents are disturbed. The index must
    # already exist — create it once with: create_index.py knowledge.
    print(f"[3/3] Upserting {len(docs)} docs into shared index '{INDEX_NAME}'...")
    try:
        await client.load_index(INDEX_NAME)
    except Exception as exc:
        raise RuntimeError(
            f"Index '{INDEX_NAME}' not found. Create it once first:\n"
            f"  uv --directory agent-py run src/create_index.py knowledge"
        ) from exc
    await client.add_docs(INDEX_NAME, docs)
    await client.load_index(INDEX_NAME)  # reload so the new docs are queryable

    # Smoke query (counts + latency only; no document text printed). Moss writes
    # are not immediately consistent, so warm with a short retry loop.
    hits = 0
    for attempt in range(6):
        try:
            await client.load_index(INDEX_NAME)
            r = await client.query(
                INDEX_NAME,
                "total income wages and taxes withheld",
                QueryOptions(
                    top_k=3,
                    filter={"field": "user_id", "condition": {"$eq": user_id}},
                ),
            )
            hits = len(getattr(r, "docs", None) or [])
            if hits:
                break
        except Exception as exc:
            print(f"  (warming, attempt {attempt + 1}: {type(exc).__name__})")
        time.sleep(3)

    return {
        "user_id": user_id,
        "doc_id": doc_id,
        "source": source,
        "chunks": len(chunks),
        "docs_upserted": len(docs),
        "smoke_hits": hits,
    }


async def main() -> None:
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    user_id = os.getenv("INGEST_USER_ID", DEFAULT_INGEST_USER)
    # The CLI defaults to a single "tax_return" document so existing local-demo
    # usage keeps working; the FastAPI service passes a real per-upload doc_id.
    doc_id = os.getenv("INGEST_DOC_ID", "tax_return")
    source = os.getenv("INGEST_SOURCE", "2025_tax_return")
    resume_job = os.getenv("UNSILOED_JOB_ID")
    if not Path(pdf_path).exists():
        raise SystemExit(f"PDF not found: {pdf_path}")
    try:
        result = await ingest_pdf(
            pdf_path, user_id, doc_id, source, resume_job=resume_job
        )
    except (RuntimeError, FileNotFoundError) as exc:
        raise SystemExit(str(exc)) from exc
    print(
        f"DONE. upserted={result['docs_upserted']} chunks={result['chunks']} "
        f"smoke_hits={result['smoke_hits']} — index '{INDEX_NAME}' now holds "
        f"user '{user_id}' doc '{doc_id}'."
    )


if __name__ == "__main__":
    asyncio.run(main())
