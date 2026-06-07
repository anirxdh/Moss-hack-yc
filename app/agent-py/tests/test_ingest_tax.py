"""Unit tests for the Unsiloed -> Moss ingest pipeline (`ingest_tax.py`).

Mocks the Unsiloed HTTP API (`requests`) and `MossClient` so the whole pipeline
is exercised offline, with no network, no real keys, and no PDF parsing.
"""

import asyncio
import types

import pytest

import ingest_tax


class _Resp:
    """Minimal stand-in for a requests.Response."""

    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:  # always OK in tests
        pass

    def json(self) -> dict:
        return self._payload


# --------------------------------------------------------------------------- #
# chunks_to_docs (pure function)
# --------------------------------------------------------------------------- #
def test_chunks_to_docs_prefers_embed_and_falls_back() -> None:
    chunks = [
        {
            "chunk_id": "a",
            "embed": "## Wages\nforty two thousand",
            "segments": [{"segment_type": "Text", "page_number": 2}],
        },
        {
            "chunk_id": "b",
            "embed": "   ",  # blank -> fall back to segment markdown
            "segments": [
                {"markdown": "fallback md", "page_number": 3, "segment_type": "Table"}
            ],
        },
        {"chunk_id": "c", "embed": "", "segments": []},  # no text -> skipped
    ]
    docs = ingest_tax.chunks_to_docs(chunks, "u1", "w2", "W-2 wages")

    # Ids are user+doc-namespaced + index-based so re-ingest upserts this
    # (user, document) only — without clobbering the user's OTHER documents.
    assert [d.id for d in docs] == ["u1-w2-chunk-0", "u1-w2-chunk-1"]
    assert "Wages" in docs[0].text
    assert docs[0].metadata["user_id"] == "u1"
    assert docs[0].metadata["doc_id"] == "w2"
    assert docs[0].metadata["chunk_id"] == "a"
    assert docs[0].metadata["page"] == "2"
    assert docs[0].metadata["types"] == "Text"
    assert docs[0].metadata["source"] == "W-2 wages"
    assert docs[1].text == "fallback md"
    assert docs[1].metadata["page"] == "3"


def test_chunks_to_docs_namespaces_id_by_user_and_doc() -> None:
    one = ingest_tax.chunks_to_docs(
        [{"embed": "hi", "segments": []}], "u9", "w2", "W-2"
    )
    assert one[0].id == "u9-w2-chunk-0"
    assert one[0].metadata["user_id"] == "u9"
    assert one[0].metadata["doc_id"] == "w2"
    assert "page" not in one[0].metadata  # no segment page_number
    assert "chunk_id" not in one[0].metadata  # none provided

    # REGRESSION (outside-voice #1): a DIFFERENT document for the SAME user must
    # NOT collide on ids — otherwise the second upload silently clobbers the
    # first's `{user}-chunk-*` ids. Per-doc namespacing keeps them distinct.
    two = ingest_tax.chunks_to_docs(
        [{"embed": "hi", "segments": []}], "u9", "1099int", "1099-INT"
    )
    assert two[0].id == "u9-1099int-chunk-0"
    assert one[0].id != two[0].id


# --------------------------------------------------------------------------- #
# submit_parse
# --------------------------------------------------------------------------- #
def test_submit_parse_returns_job_id(monkeypatch, tmp_path) -> None:
    pdf = tmp_path / "x.pdf"
    pdf.write_bytes(b"%PDF-1.4 test")
    captured: dict = {}

    def fake_post(url, headers=None, files=None, data=None, timeout=None):
        captured.update(url=url, headers=headers)
        return _Resp({"job_id": "JOB1", "status": "Starting", "credit_used": 3})

    monkeypatch.setattr(ingest_tax.requests, "post", fake_post)
    assert ingest_tax.submit_parse(str(pdf), "key123") == "JOB1"
    assert captured["url"].endswith("/parse")
    assert captured["headers"]["api-key"] == "key123"


def test_submit_parse_without_job_id_raises(monkeypatch, tmp_path) -> None:
    pdf = tmp_path / "x.pdf"
    pdf.write_bytes(b"%PDF")
    monkeypatch.setattr(
        ingest_tax.requests, "post", lambda *a, **k: _Resp({"status": "Starting"})
    )
    with pytest.raises(RuntimeError):
        ingest_tax.submit_parse(str(pdf), "key")


# --------------------------------------------------------------------------- #
# poll_job
# --------------------------------------------------------------------------- #
def test_poll_job_succeeds_after_processing(monkeypatch) -> None:
    seq = [
        _Resp({"status": "Processing", "message": "working"}),
        _Resp(
            {
                "status": "Succeeded",
                "chunks": [{"chunk_id": "a", "embed": "hi"}],
                "page_count": 1,
                "total_chunks": 1,
                "credit_used": 1,
            }
        ),
    ]
    i = {"n": 0}

    def fake_get(url, headers=None, params=None, timeout=None):
        r = seq[i["n"]]
        i["n"] += 1
        return r

    monkeypatch.setattr(ingest_tax.requests, "get", fake_get)
    monkeypatch.setattr(ingest_tax.time, "sleep", lambda *_: None)

    chunks = ingest_tax.poll_job("JOB1", "key")
    assert len(chunks) == 1 and chunks[0]["chunk_id"] == "a"


def test_poll_job_failed_raises(monkeypatch) -> None:
    monkeypatch.setattr(
        ingest_tax.requests,
        "get",
        lambda *a, **k: _Resp({"status": "Failed", "message": "bad"}),
    )
    monkeypatch.setattr(ingest_tax.time, "sleep", lambda *_: None)
    with pytest.raises(RuntimeError):
        ingest_tax.poll_job("JOB1", "key")


# --------------------------------------------------------------------------- #
# main()
# --------------------------------------------------------------------------- #
class _FakeMoss:
    def __init__(self, *a, **k) -> None:
        self.added: list = []

    async def load_index(self, name):
        pass

    async def add_docs(self, name, docs):
        self.added.append((name, len(docs)))

    async def query(self, name, q, opts):
        doc = types.SimpleNamespace(text="t", score=1.0, metadata={"page": "2"})
        return types.SimpleNamespace(docs=[doc], time_taken_ms=1)


def _set_env(monkeypatch) -> None:
    monkeypatch.setenv("UNSILOED_API_KEY", "k")
    monkeypatch.setenv("MOSS_PROJECT_ID", "p")
    monkeypatch.setenv("MOSS_PROJECT_KEY", "pk")
    monkeypatch.delenv("UNSILOED_JOB_ID", raising=False)
    monkeypatch.setattr(ingest_tax, "MossClient", _FakeMoss)
    monkeypatch.setattr(ingest_tax.time, "sleep", lambda *_: None)


def test_main_happy_path(monkeypatch, tmp_path, capsys) -> None:
    pdf = tmp_path / "tax.pdf"
    pdf.write_bytes(b"%PDF")
    _set_env(monkeypatch)
    monkeypatch.setattr(ingest_tax, "submit_parse", lambda p, k: "JOB1")
    monkeypatch.setattr(
        ingest_tax, "poll_job", lambda j, k: [{"chunk_id": "a", "embed": "hello"}]
    )
    monkeypatch.setattr(ingest_tax.sys, "argv", ["ingest_tax.py", str(pdf)])

    asyncio.run(ingest_tax.main())

    out = capsys.readouterr().out
    assert "into shared index" in out
    assert "DONE." in out
    assert "upserted=" in out


def test_ingest_pdf_returns_counts(monkeypatch, tmp_path) -> None:
    """The reusable core returns COUNTS only (no document text) and namespaces
    by (user_id, doc_id) — this is what the FastAPI service calls."""
    pdf = tmp_path / "tax.pdf"
    pdf.write_bytes(b"%PDF")
    _set_env(monkeypatch)
    monkeypatch.setattr(ingest_tax, "submit_parse", lambda p, k: "J")
    monkeypatch.setattr(
        ingest_tax,
        "poll_job",
        lambda j, k: [
            {"chunk_id": "a", "embed": "hi"},
            {"embed": "yo", "segments": []},
        ],
    )
    result = asyncio.run(ingest_tax.ingest_pdf(str(pdf), "u5", "w2", "W-2"))
    assert result["user_id"] == "u5"
    assert result["doc_id"] == "w2"
    assert result["docs_upserted"] == 2
    assert result["chunks"] == 2
    assert result["smoke_hits"] == 1


def test_main_resume_job(monkeypatch, tmp_path) -> None:
    pdf = tmp_path / "tax.pdf"
    pdf.write_bytes(b"%PDF")
    _set_env(monkeypatch)
    monkeypatch.setenv("UNSILOED_JOB_ID", "RESUME1")
    polled: dict = {}

    def _fake_poll(job_id, key):
        polled["job"] = job_id
        return [{"chunk_id": "a", "embed": "x"}]

    monkeypatch.setattr(ingest_tax, "poll_job", _fake_poll)
    monkeypatch.setattr(ingest_tax.sys, "argv", ["ingest_tax.py", str(pdf)])

    asyncio.run(ingest_tax.main())
    assert polled["job"] == "RESUME1"


def test_main_missing_key_exits(monkeypatch, tmp_path) -> None:
    # PDF exists so we reach the credential check inside ingest_pdf (which raises
    # RuntimeError -> main converts to SystemExit), not the earlier path check.
    pdf = tmp_path / "x.pdf"
    pdf.write_bytes(b"%PDF")
    monkeypatch.delenv("UNSILOED_API_KEY", raising=False)
    monkeypatch.setattr(ingest_tax.sys, "argv", ["ingest_tax.py", str(pdf)])
    with pytest.raises(SystemExit):
        asyncio.run(ingest_tax.main())


def test_main_missing_pdf_exits(monkeypatch, tmp_path) -> None:
    _set_env(monkeypatch)
    monkeypatch.setattr(
        ingest_tax.sys, "argv", ["ingest_tax.py", str(tmp_path / "nope.pdf")]
    )
    with pytest.raises(SystemExit):
        asyncio.run(ingest_tax.main())


def test_main_no_usable_text_exits(monkeypatch, tmp_path) -> None:
    """Chunks that map to no documents -> a clear SystemExit."""
    pdf = tmp_path / "tax.pdf"
    pdf.write_bytes(b"%PDF")
    _set_env(monkeypatch)
    monkeypatch.setattr(ingest_tax, "submit_parse", lambda p, k: "J")
    monkeypatch.setattr(
        ingest_tax, "poll_job", lambda j, k: [{"embed": "  ", "segments": []}]
    )
    monkeypatch.setattr(ingest_tax.sys, "argv", ["ingest_tax.py", str(pdf)])
    with pytest.raises(SystemExit):
        asyncio.run(ingest_tax.main())


def test_main_index_missing_exits(monkeypatch, tmp_path) -> None:
    """If the shared index doesn't exist yet, exit with a clear create instruction."""
    pdf = tmp_path / "tax.pdf"
    pdf.write_bytes(b"%PDF")
    _set_env(monkeypatch)

    class _NoIndex(_FakeMoss):
        async def load_index(self, name):
            raise RuntimeError("index not found")

    monkeypatch.setattr(ingest_tax, "MossClient", _NoIndex)
    monkeypatch.setattr(ingest_tax, "submit_parse", lambda p, k: "J")
    monkeypatch.setattr(
        ingest_tax, "poll_job", lambda j, k: [{"chunk_id": "a", "embed": "hi"}]
    )
    monkeypatch.setattr(ingest_tax.sys, "argv", ["ingest_tax.py", str(pdf)])

    with pytest.raises(SystemExit):
        asyncio.run(ingest_tax.main())


def test_main_smoke_query_no_hits(monkeypatch, tmp_path, capsys) -> None:
    """The verification loop handles a no-hits smoke query gracefully."""
    pdf = tmp_path / "tax.pdf"
    pdf.write_bytes(b"%PDF")
    _set_env(monkeypatch)

    class _NoHits(_FakeMoss):
        async def query(self, name, q, opts):
            return types.SimpleNamespace(docs=[], time_taken_ms=0)

    monkeypatch.setattr(ingest_tax, "MossClient", _NoHits)
    monkeypatch.setattr(ingest_tax, "submit_parse", lambda p, k: "J")
    monkeypatch.setattr(
        ingest_tax, "poll_job", lambda j, k: [{"chunk_id": "a", "embed": "hi"}]
    )
    monkeypatch.setattr(ingest_tax.sys, "argv", ["ingest_tax.py", str(pdf)])

    asyncio.run(ingest_tax.main())
    assert "0" in capsys.readouterr().out
