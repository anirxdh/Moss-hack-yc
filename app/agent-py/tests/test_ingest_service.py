"""Unit tests for the FastAPI ingest service (`ingest_service.py`).

Mocks S3 (boto3 download) and the Moss pipeline (`ingest_pdf`) so the HTTP
surface, the shared-secret trust boundary, the per-user key check, and the
background worker's success/failure paths are all exercised offline.
"""

import pytest
from fastapi.testclient import TestClient

import ingest_service

SECRET = "test-secret"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(ingest_service, "INGEST_SECRET", SECRET)
    ingest_service._JOBS.clear()
    return TestClient(ingest_service.app)


class _FakeS3:
    def download_file(self, bucket, key, path):
        # Simulate a successful download by creating the local temp file.
        with open(path, "wb") as fh:
            fh.write(b"%PDF fake")


async def _fake_ingest_pdf(path, user_id, doc_id, source):
    return {
        "user_id": user_id,
        "doc_id": doc_id,
        "source": source,
        "chunks": 3,
        "docs_upserted": 3,
        "smoke_hits": 2,
    }


def _body(**over):
    base = {
        "s3_key": "users/u1/w2/abc-w2.pdf",
        "user_id": "u1",
        "doc_id": "w2",
        "source": "W-2",
    }
    base.update(over)
    return base


# --------------------------------------------------------------------------- #
# health
# --------------------------------------------------------------------------- #
def test_health_ok(client) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# --------------------------------------------------------------------------- #
# trust boundary
# --------------------------------------------------------------------------- #
def test_ingest_requires_secret(client) -> None:
    r = client.post("/ingest", json=_body())  # no X-Ingest-Secret header
    assert r.status_code == 401


def test_ingest_rejects_wrong_secret(client) -> None:
    r = client.post("/ingest", json=_body(), headers={"X-Ingest-Secret": "nope"})
    assert r.status_code == 401


def test_ingest_500_when_secret_unset(client, monkeypatch) -> None:
    monkeypatch.setattr(ingest_service, "INGEST_SECRET", None)
    r = client.post("/ingest", json=_body(), headers={"X-Ingest-Secret": "x"})
    assert r.status_code == 500


def test_ingest_rejects_key_outside_user_prefix(client) -> None:
    # A key under another user's prefix must be refused — defends the identity seam.
    r = client.post(
        "/ingest",
        json=_body(s3_key="users/someone-else/w2/x.pdf"),
        headers={"X-Ingest-Secret": SECRET},
    )
    assert r.status_code == 400


# --------------------------------------------------------------------------- #
# happy path + background worker
# --------------------------------------------------------------------------- #
def test_ingest_accepts_and_processes(client, monkeypatch) -> None:
    monkeypatch.setattr(ingest_service, "_s3_client", lambda: _FakeS3())
    monkeypatch.setattr(ingest_service, "ingest_pdf", _fake_ingest_pdf)

    r = client.post("/ingest", json=_body(), headers={"X-Ingest-Secret": SECRET})
    assert r.status_code == 202
    job_id = r.json()["job_id"]
    assert job_id

    # TestClient runs the background task before returning — status should be ready.
    status = client.get(f"/ingest/status/{job_id}")
    assert status.status_code == 200
    data = status.json()
    assert data["status"] == "ready"
    assert data["docs_upserted"] == 3
    assert data["user_id"] == "u1"


def test_ingest_records_failure(client, monkeypatch) -> None:
    class _BrokenS3:
        def download_file(self, *a, **k):
            raise RuntimeError("s3 down")

    monkeypatch.setattr(ingest_service, "_s3_client", lambda: _BrokenS3())

    r = client.post("/ingest", json=_body(), headers={"X-Ingest-Secret": SECRET})
    assert r.status_code == 202
    job_id = r.json()["job_id"]

    data = client.get(f"/ingest/status/{job_id}").json()
    assert data["status"] == "failed"
    assert "s3 down" in data["error"]


def test_status_unknown_job_404(client) -> None:
    assert client.get("/ingest/status/does-not-exist").status_code == 404
