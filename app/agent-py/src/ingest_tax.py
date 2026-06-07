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


def chunks_to_docs(chunks: list[dict]) -> list[DocumentInfo]:
    """Turn Unsiloed chunks into Moss documents. Prefer chunk['embed'] (Markdown)."""
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
        cid = ch.get("chunk_id") or f"chunk-{i}"
        meta = {"source": "2025_tax_return", "chunk_index": str(i)}
        if page is not None:
            meta["page"] = str(page)
        if types:
            meta["types"] = ",".join(types)[:200]
        docs.append(DocumentInfo(id=str(cid), text=text, metadata=meta))
    return docs


async def main() -> None:
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    api_key = os.getenv("UNSILOED_API_KEY")
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")

    if not api_key:
        raise SystemExit("UNSILOED_API_KEY missing from agent-py/.env.local")
    if not (project_id and project_key):
        raise SystemExit("MOSS_PROJECT_ID / MOSS_PROJECT_KEY missing")
    if not Path(pdf_path).exists():
        raise SystemExit(f"PDF not found: {pdf_path}")

    resume_job = os.getenv("UNSILOED_JOB_ID")
    if resume_job:
        print(f"[1/3] Resuming existing Unsiloed job: {resume_job}")
        chunks = poll_job(resume_job, api_key)
    else:
        print(f"[1/3] Parsing with Unsiloed: {Path(pdf_path).name}")
        job_id = submit_parse(pdf_path, api_key)
        chunks = poll_job(job_id, api_key)
    docs = chunks_to_docs(chunks)
    print(f"[2/3] Prepared {len(docs)} Moss docs from {len(chunks)} chunks.")
    if not docs:
        raise SystemExit("No usable text parsed from the PDF.")

    client = MossClient(project_id, project_key)
    # Replace any existing index so re-runs are clean (best-effort delete).
    try:
        await client.delete_index(INDEX_NAME)
        print(f"      (removed existing '{INDEX_NAME}' index)")
    except Exception as exc:  # index may not exist yet
        print(f"      (no existing '{INDEX_NAME}' to remove: {type(exc).__name__})")

    print(f"[3/3] Building Moss index '{INDEX_NAME}' ({len(docs)} docs, model {MODEL_ID})...")
    result = await client.create_index(INDEX_NAME, docs, MODEL_ID)
    print(
        f"      done (job: {result.job_id}, index: {result.index_name}, docs: {result.doc_count})"
    )

    # Smoke query (counts + latency only; no document text printed).
    print("Verifying retrieval...")
    hits = 0
    latency = None
    for attempt in range(6):
        try:
            await client.load_index(INDEX_NAME)
            r = await client.query(
                INDEX_NAME, "total income wages and taxes withheld", QueryOptions(top_k=3)
            )
            rdocs = getattr(r, "docs", None) or []
            hits = len(rdocs)
            latency = getattr(r, "time_taken_ms", None)
            pages = sorted(
                {
                    (getattr(d, "metadata", {}) or {}).get("page", "?")
                    for d in rdocs
                }
            )
            if hits:
                print(
                    f"  retrieval OK: {hits} hits, time_taken_ms={latency}, pages={pages}"
                )
                break
        except Exception as exc:
            print(f"  (warming, attempt {attempt + 1}: {type(exc).__name__})")
        time.sleep(3)
    if not hits:
        print("  index created but smoke query returned 0 (may still be building).")
    print("DONE. The 'knowledge' index now holds your tax document.")


if __name__ == "__main__":
    asyncio.run(main())
