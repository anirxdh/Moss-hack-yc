"""Tests for the Robinhood financial-profile ingest CLI flow (`main`)."""

import asyncio
import types

import pytest
from moss import DocumentInfo

import ingest_robinhood


class _FakeMoss:
    fail_add = False

    def __init__(self, *a, **k) -> None:
        self.added: list = []
        self.created: list = []

    async def add_docs(self, name, docs):
        if self.fail_add:
            raise RuntimeError("index does not exist yet")
        self.added.append((name, len(docs)))

    async def create_index(self, name, docs, model):
        self.created.append(name)
        return types.SimpleNamespace(job_id="J", index_name=name, doc_count=len(docs))

    async def load_index(self, name):
        pass

    async def query(self, name, q, opts):
        return types.SimpleNamespace(docs=[], time_taken_ms=1)


def _fake_docs():
    return [
        DocumentInfo(
            id="d1",
            text="t",
            metadata={"type": "holding", "source": "rh", "symbol": "X"},
        )
    ]


def _prep(monkeypatch, tmp_path):
    prof = tmp_path / "profile.json"
    prof.write_text("{}")
    monkeypatch.setenv("MOSS_PROJECT_ID", "p")
    monkeypatch.setenv("MOSS_PROJECT_KEY", "pk")
    monkeypatch.setattr(ingest_robinhood, "load_profile", lambda p: {})
    monkeypatch.setattr(
        ingest_robinhood, "build_documents", lambda prof, user_id: _fake_docs()
    )
    monkeypatch.setattr(
        ingest_robinhood.sys, "argv", ["ingest_robinhood.py", str(prof)]
    )
    return prof


def test_main_appends_to_index(monkeypatch, tmp_path, capsys) -> None:
    _prep(monkeypatch, tmp_path)
    monkeypatch.setattr(ingest_robinhood, "MossClient", _FakeMoss)

    asyncio.run(ingest_robinhood.main())

    assert "DONE" in capsys.readouterr().out


def test_main_falls_back_to_create_index(monkeypatch, tmp_path, capsys) -> None:
    _prep(monkeypatch, tmp_path)

    class _FailAdd(_FakeMoss):
        fail_add = True

    monkeypatch.setattr(ingest_robinhood, "MossClient", _FailAdd)

    asyncio.run(ingest_robinhood.main())

    assert "created index" in capsys.readouterr().out


def test_main_missing_creds_exits(monkeypatch, tmp_path) -> None:
    prof = tmp_path / "p.json"
    prof.write_text("{}")
    monkeypatch.delenv("MOSS_PROJECT_ID", raising=False)
    monkeypatch.delenv("MOSS_PROJECT_KEY", raising=False)
    monkeypatch.setattr(
        ingest_robinhood.sys, "argv", ["ingest_robinhood.py", str(prof)]
    )
    with pytest.raises(SystemExit):
        asyncio.run(ingest_robinhood.main())


def test_main_missing_profile_exits(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MOSS_PROJECT_ID", "p")
    monkeypatch.setenv("MOSS_PROJECT_KEY", "pk")
    monkeypatch.setattr(
        ingest_robinhood.sys,
        "argv",
        ["ingest_robinhood.py", str(tmp_path / "nope.json")],
    )
    with pytest.raises(SystemExit):
        asyncio.run(ingest_robinhood.main())
