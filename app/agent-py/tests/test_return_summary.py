"""Unit tests for the typed return-summary model + loader (offline, no creds).

Covers the numeric-truth source: the refund vs OWED paths, graceful handling of
missing/optional data, and that year-over-year deltas are read (never computed).
"""

import json

import pytest

import return_summary as rs


def _base() -> dict:
    return {
        "tax_year": 2025,
        "filing_status": "mfj",
        "agi": 142000,
        "total_tax": 18500,
        "total_withholding": 22700,
        "refund_or_owed": 4200,
    }


def test_refund_headline_and_flags() -> None:
    summary = rs.from_dict(_base())
    assert summary.is_refund is True
    assert "refund of 4200 dollars" in summary.headline()
    assert summary.filing_status_spoken() == "married filing jointly"


def test_owed_case_headline() -> None:
    """The negative (owed) path must say 'you owe', not 'refund'."""
    data = _base() | {"refund_or_owed": -1700, "filing_status": "single"}
    summary = rs.from_dict(data)
    assert summary.is_refund is False
    assert "owe 1700 dollars" in summary.headline()
    assert "refund" not in summary.headline().lower()


def test_missing_required_field_raises() -> None:
    data = _base()
    del data["refund_or_owed"]
    with pytest.raises(ValueError, match="missing required field"):
        rs.from_dict(data)


def test_non_integer_field_raises() -> None:
    data = _base() | {"agi": "not-a-number"}
    with pytest.raises(ValueError, match="must be an integer"):
        rs.from_dict(data)


def test_states_parsed_and_multistate_flag() -> None:
    data = _base() | {
        "states": [
            {"state": "California", "refund_or_owed": 600, "note": "resident"},
            {"state": "New York", "refund_or_owed": -300},
        ]
    }
    summary = rs.from_dict(data)
    assert summary.is_multistate is True
    assert summary.states[0].is_refund is True
    assert summary.states[0].spoken() == "California: refund of 600 dollars (resident)"
    assert summary.states[1].spoken() == "New York: you owe 300 dollars"


def test_malformed_state_entry_skipped_not_invented() -> None:
    data = _base() | {
        "states": [
            {"refund_or_owed": 100},
            "nope",
            {"state": "Texas", "refund_or_owed": 0},
        ]
    }
    summary = rs.from_dict(data)
    # Only the valid entry survives; nothing is fabricated for the bad ones.
    assert len(summary.states) == 1
    assert summary.states[0].state == "Texas"
    assert summary.is_multistate is False


def test_yoy_is_read_not_computed() -> None:
    data = _base() | {
        "yoy": {
            "refund_change": -1200,
            "agi_change": 4000,
            "summary": "Refund is smaller this year.",
        }
    }
    summary = rs.from_dict(data)
    assert summary.yoy is not None
    assert summary.yoy.refund_change == -1200
    assert "smaller" in summary.yoy.summary


def test_yoy_without_summary_ignored() -> None:
    data = _base() | {"yoy": {"refund_change": -1200, "agi_change": 4000}}
    assert rs.from_dict(data).yoy is None


def test_spoken_summary_includes_optional_beats_only_when_present() -> None:
    minimal = rs.from_dict(_base())
    spoken_min = minimal.spoken_summary()
    assert "By state" not in spoken_min  # no states -> beat skipped

    full = rs.from_dict(
        _base()
        | {
            "states": [{"state": "California", "refund_or_owed": 600}],
            "yoy": {
                "refund_change": -1200,
                "agi_change": 4000,
                "summary": "Smaller refund.",
            },
        }
    )
    spoken_full = full.spoken_summary()
    assert "By state: California" in spoken_full
    assert "Smaller refund." in spoken_full
    assert "Adjusted gross income 142000 dollars" in spoken_full


def test_load_demo_fixtures_real() -> None:
    """Both shipped demo fixtures parse and stay internally consistent."""
    refund = rs.load_return_summary(rs.DEFAULT_RETURN_PATH)
    assert refund.is_refund is True
    # refund_or_owed must equal withholding minus total tax (consistency guard).
    assert refund.refund_or_owed == refund.total_withholding - refund.total_tax

    owed_path = rs.DEFAULT_RETURN_PATH.parent / "demo_return_owed.json"
    owed = rs.load_return_summary(owed_path)
    assert owed.is_refund is False
    assert owed.refund_or_owed == owed.total_withholding - owed.total_tax


def test_load_missing_file_raises(tmp_path) -> None:
    with pytest.raises(FileNotFoundError):
        rs.load_return_summary(tmp_path / "nope.json")


def test_from_dict_rejects_non_object() -> None:
    with pytest.raises(ValueError, match="must be a JSON object"):
        rs.from_dict(["not", "a", "dict"])


def test_demo_fixtures_have_consistent_json_note() -> None:
    """The fixtures carry a _note marking them as non-PII demo data."""
    with rs.DEFAULT_RETURN_PATH.open() as fh:
        assert "DEMO FIXTURE" in json.load(fh)["_note"]
