"""Unit tests for the Moss index builder (`create_index.py`), offline."""

import asyncio
import types

import pytest

import create_index


def test_memory_seed_documents() -> None:
    docs = create_index._memory_seed_documents()
    assert len(docs) == 1
    assert docs[0].metadata["user_id"] == "__seed__"


def test_load_knowledge_documents_real() -> None:
    """The starter's knowledge.json ships with the repo and parses to docs."""
    docs = create_index._load_knowledge_documents()
    assert len(docs) > 0
    assert all(d.id and d.text for d in docs)


def test_load_knowledge_missing_file(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(create_index, "KNOWLEDGE_PATH", tmp_path / "nope.json")
    with pytest.raises(FileNotFoundError):
        create_index._load_knowledge_documents()


def test_load_knowledge_not_a_list(monkeypatch, tmp_path) -> None:
    p = tmp_path / "k.json"
    p.write_text('{"not": "a list"}')
    monkeypatch.setattr(create_index, "KNOWLEDGE_PATH", p)
    with pytest.raises(ValueError):
        create_index._load_knowledge_documents()


def test_load_knowledge_no_valid_entries(monkeypatch, tmp_path) -> None:
    p = tmp_path / "k.json"
    p.write_text('[{"id": "x"}, {"text": "y"}, "nope"]')  # all invalid/filtered
    monkeypatch.setattr(create_index, "KNOWLEDGE_PATH", p)
    with pytest.raises(ValueError):
        create_index._load_knowledge_documents()


def test_load_knowledge_coerces_metadata_to_str(monkeypatch, tmp_path) -> None:
    p = tmp_path / "k.json"
    p.write_text('[{"id": "1", "text": "hi", "metadata": {"n": 5}}]')
    monkeypatch.setattr(create_index, "KNOWLEDGE_PATH", p)
    docs = create_index._load_knowledge_documents()
    assert docs[0].metadata == {"n": "5"}


class _FakeMoss:
    def __init__(self, *a, **k) -> None:
        self.created: list = []

    async def create_index(self, name, docs, model):
        self.created.append(name)
        return types.SimpleNamespace(job_id="J", index_name=name, doc_count=len(docs))


def test_build_indexes_creates_both(monkeypatch, capsys) -> None:
    monkeypatch.setenv("MOSS_PROJECT_ID", "p")
    monkeypatch.setenv("MOSS_PROJECT_KEY", "pk")
    monkeypatch.setattr(create_index, "MossClient", _FakeMoss)

    asyncio.run(create_index.build_indexes())

    assert "Both Moss indexes created" in capsys.readouterr().out


def test_build_indexes_missing_creds_raises(monkeypatch) -> None:
    monkeypatch.delenv("MOSS_PROJECT_ID", raising=False)
    monkeypatch.delenv("MOSS_PROJECT_KEY", raising=False)
    with pytest.raises(OSError):
        asyncio.run(create_index.build_indexes())
