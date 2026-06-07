"""Unit tests for the Robinhood financial-profile ingestion (no network/creds).

Exercises the pure transform (load_profile -> build_documents) against the
bundled mock portfolio. The live add_docs/query path is covered by running
src/ingest_robinhood.py with Moss credentials.
"""

from pathlib import Path

from ingest_robinhood import SOURCE, build_documents, load_profile

MOCK = Path(__file__).resolve().parent.parent / "data" / "mock_portfolio.json"


def test_load_profile_has_expected_sections() -> None:
    profile = load_profile(MOCK)
    assert profile["positions"], "expected at least one position"
    assert "account" in profile
    assert "dividends_ytd" in profile
    assert "realized_gains_ytd" in profile


def test_build_documents_covers_every_position_plus_summaries() -> None:
    profile = load_profile(MOCK)
    docs = build_documents(profile)

    ids = [d.id for d in docs]
    assert len(ids) == len(set(ids)), "document ids must be unique/stable"

    # One doc per position + account summary + dividends + realized gains.
    assert len(docs) == len(profile["positions"]) + 3

    # Every doc is tagged as robinhood and has non-empty text.
    for d in docs:
        assert d.metadata["source"] == SOURCE
        assert d.text.strip()

    assert "rh-account-summary" in ids
    assert "rh-dividends" in ids
    assert "rh-realized-gains" in ids


def test_position_documents_carry_symbol_and_mention_it() -> None:
    profile = load_profile(MOCK)
    docs = build_documents(profile)
    positions = [d for d in docs if d.metadata["type"] == "position"]
    assert len(positions) == len(profile["positions"])
    for d in positions:
        sym = d.metadata["symbol"]
        assert d.id == f"rh-position-{sym}"
        assert sym in d.text


def test_tax_relevant_chunks_reference_the_right_forms() -> None:
    docs = build_documents(load_profile(MOCK))
    by_id = {d.id: d.text for d in docs}
    assert "1099-DIV" in by_id["rh-dividends"]
    assert "1099-B" in by_id["rh-realized-gains"]
