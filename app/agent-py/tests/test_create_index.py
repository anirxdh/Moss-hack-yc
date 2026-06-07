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


def test_load_taxcode_documents_real() -> None:
    """taxcode.json ships with the repo and parses into a non-trivial corpus.

    The refusal beat is only credible with a real corpus, so guard against the
    file shrinking to a handful of gameable chunks and against missing citation
    metadata (every chunk must name its source).
    """
    docs = create_index._load_taxcode_documents()
    assert len(docs) >= 40, "taxcode corpus is suspiciously small"
    assert all(d.id and d.text for d in docs)
    assert all(d.metadata.get("source") for d in docs), (
        "every chunk needs a citation source"
    )
    assert all(d.metadata.get("jurisdiction") for d in docs)


def test_load_taxcode_missing_file(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(create_index, "TAXCODE_PATH", tmp_path / "nope.json")
    with pytest.raises(FileNotFoundError):
        create_index._load_taxcode_documents()


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


def test_build_indexes_creates_all(monkeypatch, capsys) -> None:
    monkeypatch.setenv("MOSS_PROJECT_ID", "p")
    monkeypatch.setenv("MOSS_PROJECT_KEY", "pk")
    monkeypatch.setattr(create_index, "MossClient", _FakeMoss)

    asyncio.run(create_index.build_indexes())

    out = capsys.readouterr().out
    assert "All Moss indexes created" in out
    # All three indexes — knowledge, memory, taxcode — must be built.
    assert "taxcode" in out


def test_build_indexes_missing_creds_raises(monkeypatch) -> None:
    monkeypatch.delenv("MOSS_PROJECT_ID", raising=False)
    monkeypatch.delenv("MOSS_PROJECT_KEY", raising=False)
    with pytest.raises(OSError):
        asyncio.run(create_index.build_indexes())


def test_build_only_taxcode_does_not_touch_knowledge(monkeypatch, capsys) -> None:
    """`which={'taxcode'}` rebuilds ONLY taxcode, leaving the 1040 in knowledge."""
    monkeypatch.setenv("MOSS_PROJECT_ID", "p")
    monkeypatch.setenv("MOSS_PROJECT_KEY", "pk")
    fake = _FakeMoss()
    monkeypatch.setattr(create_index, "MossClient", lambda *a, **k: fake)

    asyncio.run(create_index.build_indexes({"taxcode"}))

    # Only the taxcode index was (re)built — knowledge/memory untouched.
    assert fake.created == ["taxcode"]
    out = capsys.readouterr().out
    assert "Built Moss index(es): taxcode" in out
    assert "All Moss indexes created" not in out
