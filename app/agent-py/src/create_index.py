"""Build the Moss indexes used by this voice agent.

Creates two indexes from the credentials in ``agent-py/.env.local``:

* the static ``knowledge`` index (RAG corpus), seeded from ``agent-py/knowledge.json``
* the ``memory`` index (per-user agentic memory), seeded with a single placeholder
  document so the index exists and can be loaded before the first runtime write.

Run from the repo root via ``pnpm moss:index`` (which invokes
``uv --directory agent-py run src/create_index.py``) once Moss credentials are set.
This script needs ``MOSS_PROJECT_ID`` / ``MOSS_PROJECT_KEY`` to run; without them it
exits with a clear message instead of contacting Moss.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from moss import DocumentInfo, MossClient

# Resolve paths relative to this file so the script works regardless of the
# current working directory. ``src/create_index.py`` -> parent.parent == agent-py/.
AGENT_DIR = Path(__file__).resolve().parent.parent
KNOWLEDGE_PATH = AGENT_DIR / "knowledge.json"
TAXCODE_PATH = AGENT_DIR / "taxcode.json"
ENV_PATH = AGENT_DIR / ".env.local"

DEFAULT_MODEL_ID = "moss-minilm"
DEFAULT_KNOWLEDGE_INDEX = "knowledge"
DEFAULT_MEMORY_INDEX = "memory"
DEFAULT_TAXCODE_INDEX = "taxcode"

# Load environment variables from agent-py/.env.local.
load_dotenv(ENV_PATH)


def _load_documents(path: Path, label: str) -> list[DocumentInfo]:
    """Load a JSON corpus file into Moss DocumentInfo entries.

    The file must be a list of ``{"id", "text", "metadata"?}`` objects. Entries
    missing an id or text are skipped; metadata values are coerced to strings
    (Moss stores/compares metadata as strings). Shared by the knowledge (RAG)
    and taxcode (cited tax-law) corpora so both parse identically.
    """
    if not path.exists():
        raise FileNotFoundError(f"{label} data file not found at {path}.")

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError(f"{path.name} must be a list of document entries.")

    documents: list[DocumentInfo] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        doc_id = entry.get("id")
        text = entry.get("text")
        if not doc_id or not text:
            continue
        metadata = entry.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
        # Moss metadata values must be strings.
        metadata = {str(k): str(v) for k, v in metadata.items()}
        documents.append(
            DocumentInfo(id=str(doc_id), text=str(text), metadata=metadata)
        )

    if not documents:
        raise ValueError(f"No valid documents were loaded from {path.name}.")

    return documents


def _load_knowledge_documents() -> list[DocumentInfo]:
    """Load knowledge.json (the RAG corpus) into Moss DocumentInfo entries."""
    return _load_documents(KNOWLEDGE_PATH, "Knowledge")


def _load_taxcode_documents() -> list[DocumentInfo]:
    """Load taxcode.json (the cited tax-law corpus) into Moss DocumentInfo entries."""
    return _load_documents(TAXCODE_PATH, "Tax-code")


def _memory_seed_documents() -> list[DocumentInfo]:
    """A single placeholder doc so the memory index exists and loads cleanly.

    The agent's memory tools upsert real per-user documents at runtime (matching
    ``id`` upserts). This seed is filtered out at query time by its ``user_id``.
    """
    return [
        DocumentInfo(
            id="__seed__",
            text="(memory seed) placeholder document so the memory index can be loaded before the first write.",
            metadata={"user_id": "__seed__"},
        )
    ]


ALL_INDEXES = ("knowledge", "memory", "taxcode")


async def build_indexes(which: set[str] | None = None) -> None:
    """(Re)build Moss indexes. ``which`` selects a subset; None builds all.

    IMPORTANT: ``knowledge`` is the home of the user's PARSED 1040 (loaded by
    src/ingest_tax.py from the real PDF). Rebuilding ``knowledge`` here reseeds it
    from the starter's placeholder ``knowledge.json`` and OVERWRITES that return.
    So to (re)build only the cited tax-law corpus without touching the 1040, run:

        uv --directory agent-py run src/create_index.py taxcode
    """
    which = which or set(ALL_INDEXES)
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    knowledge_index = os.getenv("MOSS_INDEX_NAME", DEFAULT_KNOWLEDGE_INDEX)
    memory_index = os.getenv("MOSS_MEMORY_INDEX_NAME", DEFAULT_MEMORY_INDEX)
    taxcode_index = os.getenv("MOSS_TAXCODE_INDEX_NAME", DEFAULT_TAXCODE_INDEX)
    model_id = os.getenv("MOSS_MODEL_ID", DEFAULT_MODEL_ID)

    missing = [
        name
        for name, value in {
            "MOSS_PROJECT_ID": project_id,
            "MOSS_PROJECT_KEY": project_key,
        }.items()
        if not value
    ]
    if missing:
        raise OSError(
            "Missing required Moss environment variables: "
            + ", ".join(missing)
            + f". Set them in {ENV_PATH} before running this script."
        )

    assert project_id is not None
    assert project_key is not None

    client = MossClient(project_id, project_key)

    async def _build(name: str, index_name: str, docs: list[DocumentInfo]) -> None:
        print(
            f"Creating Moss {name} index '{index_name}' with "
            f"{len(docs)} docs using model '{model_id}'..."
        )
        result = await client.create_index(index_name, docs, model_id)
        print(
            f"  done (job: {result.job_id}, index: {result.index_name}, "
            f"docs: {result.doc_count})"
        )

    if "knowledge" in which:
        await _build("knowledge", knowledge_index, _load_knowledge_documents())
    if "memory" in which:
        await _build("memory", memory_index, _memory_seed_documents())
    if "taxcode" in which:
        await _build("taxcode", taxcode_index, _load_taxcode_documents())

    if which == set(ALL_INDEXES):
        print(
            "All Moss indexes created. Knowledge (RAG), memory, and taxcode "
            "(cited tax-law corpus) are ready for use."
        )
    else:
        print(f"Built Moss index(es): {', '.join(sorted(which))}.")


if __name__ == "__main__":  # pragma: no cover
    # Optional positional args pick which indexes to build, e.g.
    #   create_index.py taxcode        -> only the cited tax-law corpus
    #   create_index.py knowledge memory taxcode  (or no args) -> all three
    requested = {a.lower() for a in sys.argv[1:]}
    unknown = requested - set(ALL_INDEXES)
    if unknown:
        raise SystemExit(
            f"Unknown index(es): {', '.join(sorted(unknown))}. "
            f"Choose from: {', '.join(ALL_INDEXES)}."
        )
    asyncio.run(build_indexes(requested or None))
