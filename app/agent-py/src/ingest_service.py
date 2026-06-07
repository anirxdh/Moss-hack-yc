"""FastAPI ingest service for the AI-CPA document-upload pipeline.

The Next.js frontend uploads a PDF directly to S3 (presigned POST), then calls
``POST /ingest`` here with the object key. We download the object and run the
existing Unsiloed -> Moss pipeline (``ingest_tax.ingest_pdf``) in a background
task, so the slow (up to ~30 min) parse never blocks the HTTP request — the
route returns ``202 Accepted`` immediately with a ``job_id``.

    Next /api/uploads/complete  --(X-Ingest-Secret)-->  POST /ingest  -> 202
                                                            |
                                                            v  (background)
                                          S3 get_object -> ingest_pdf -> Moss

Trust boundary
--------------
``/ingest`` is callable ONLY by the Next server, authenticated with a shared
secret (``X-Ingest-Secret`` must equal ``AGENT_INGEST_SECRET``). The browser
never reaches this service and never supplies ``user_id`` — the Clerk-authed
Next route does. Without this gate, anyone who could reach the service could
ingest into another user's namespace and defeat the agent's per-user retrieval
filter (``agent.py`` search_knowledge).

Privacy: never logs document text; only counts, ids, and status.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path
from uuid import uuid4

import boto3
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel

from ingest_tax import ingest_pdf

AGENT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(AGENT_DIR / ".env.local")

INGEST_SECRET = os.getenv("AGENT_INGEST_SECRET")
S3_BUCKET = os.getenv("S3_UPLOAD_BUCKET", "moss-yc-hackathon-docs")
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")

app = FastAPI(title="AI-CPA ingest service")

# In-memory job store. Fine for a single-process hackathon service; a production
# deploy would back this with a durable store (see plan's NOT-in-scope).
# job_id -> { status: queued|processing|ready|failed, key, user_id, ... }
_JOBS: dict[str, dict] = {}


class IngestRequest(BaseModel):
    s3_key: str
    user_id: str
    doc_id: str
    source: str | None = None


def _require_secret(x_ingest_secret: str | None) -> None:
    """Reject any caller that doesn't present the shared secret."""
    if not INGEST_SECRET:
        raise HTTPException(status_code=500, detail="ingest secret not configured")
    if x_ingest_secret != INGEST_SECRET:
        raise HTTPException(status_code=401, detail="invalid ingest secret")


def _s3_client():
    """boto3 S3 client (reads AWS_PROFILE / region from the environment)."""
    return boto3.client("s3", region_name=AWS_REGION)


async def _run_ingest(job_id: str, req: IngestRequest) -> None:
    """Background worker: download the S3 object and run the ingest pipeline.

    Never raises — any failure is recorded as ``status=failed`` so the frontend
    can surface "couldn't process" instead of a silent success. Re-running with
    the same (s3_key, doc_id) is safe: ``ingest_pdf`` upserts by namespaced id.
    """
    _JOBS[job_id] = {"status": "processing", "key": req.s3_key, "user_id": req.user_id}
    tmp_path: str | None = None
    try:
        fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        # boto3 is synchronous — run it off the event loop.
        await asyncio.to_thread(
            _s3_client().download_file, S3_BUCKET, req.s3_key, tmp_path
        )
        result = await ingest_pdf(
            tmp_path, req.user_id, req.doc_id, req.source or req.doc_id
        )
        _JOBS[job_id] = {"status": "ready", "key": req.s3_key, **result}
    except Exception as exc:  # record as failed, never crash the worker
        _JOBS[job_id] = {
            "status": "failed",
            "key": req.s3_key,
            "user_id": req.user_id,
            "error": f"{type(exc).__name__}: {exc}",
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "bucket": S3_BUCKET, "region": AWS_REGION}


@app.post("/ingest", status_code=202)
async def ingest(
    req: IngestRequest,
    background: BackgroundTasks,
    x_ingest_secret: str | None = Header(default=None),
) -> dict:
    _require_secret(x_ingest_secret)
    # Defense in depth: the key MUST live under the declared user's prefix, so a
    # caller can't ingest one user's object under another user's id.
    if not req.s3_key.startswith(f"users/{req.user_id}/"):
        raise HTTPException(status_code=400, detail="key not under user's prefix")
    job_id = uuid4().hex
    _JOBS[job_id] = {"status": "queued", "key": req.s3_key, "user_id": req.user_id}
    background.add_task(_run_ingest, job_id, req)
    return {"job_id": job_id, "status": "queued"}


@app.get("/ingest/status/{job_id}")
async def ingest_status(job_id: str) -> dict:
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="unknown job")
    return {"job_id": job_id, **job}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("INGEST_PORT", "8000")))
