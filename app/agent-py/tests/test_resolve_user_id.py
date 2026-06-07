"""Unit tests for resolve_user_id — the fail-CLOSED identity resolver.

A real LiveKit dispatch that arrives with malformed or missing metadata must
NOT fall back to the console default user (user_1) — that would serve one
user's tax return to an unknown caller. It must resolve to a sentinel that
matches no real user's documents instead.
"""

from agent import DEFAULT_USER_ID, UNVERIFIED_USER_ID, resolve_user_id


def test_no_metadata_is_console_default() -> None:
    assert resolve_user_id(None) == DEFAULT_USER_ID
    assert resolve_user_id("") == DEFAULT_USER_ID


def test_valid_metadata_returns_user_id() -> None:
    assert resolve_user_id('{"user_id": "user_abc"}') == "user_abc"


def test_invalid_json_fails_closed() -> None:
    assert resolve_user_id("{not json") == UNVERIFIED_USER_ID


def test_missing_user_id_fails_closed() -> None:
    assert resolve_user_id('{"foo": "bar"}') == UNVERIFIED_USER_ID


def test_empty_user_id_fails_closed() -> None:
    assert resolve_user_id('{"user_id": ""}') == UNVERIFIED_USER_ID


def test_non_string_user_id_fails_closed() -> None:
    assert resolve_user_id('{"user_id": 123}') == UNVERIFIED_USER_ID


def test_sentinel_is_distinct_from_console_default() -> None:
    # The whole point: a bad dispatch must NOT resolve to a real/usable user.
    assert UNVERIFIED_USER_ID != DEFAULT_USER_ID
