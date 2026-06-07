"""Unit tests for the agent's three Moss-backed tools.

Unlike the LLM-judged evals in `test_agent.py`, these are deterministic unit
tests that exercise the tool methods directly. They stub `MossClient` via
monkeypatch so they run with no Moss credentials and no network access — the
live, credentialed behavior is validated in the live-test task.
"""

import json

import pytest

import agent as agent_module
from agent import Assistant

USER_ID = "user_42"


class _FakeDoc:
    """Stand-in for a Moss query-result document (`.text/.score/.metadata`)."""

    def __init__(self, text: str, score=None, metadata=None) -> None:
        self.text = text
        self.score = score
        self.metadata = metadata


class _FakeSearchResult:
    """Stand-in for a Moss `SearchResult` (`.docs/.time_taken_ms`)."""

    def __init__(self, docs, time_taken_ms: float = 12.5) -> None:
        self.docs = docs
        self.time_taken_ms = time_taken_ms


class _FakeMossClient:
    """Records calls instead of contacting Moss. Substituted for `MossClient`.

    `MossClient(project_id, project_key)` is constructed inside
    `Assistant.__init__`, so each Assistant gets its own instance, reachable in
    tests as `assistant._moss`.
    """

    def __init__(self, *args, **kwargs) -> None:
        self.load_index_calls: list[str] = []
        self.query_calls: list[tuple] = []
        self.add_docs_calls: list[tuple] = []
        # Default empty result; tests override before invoking a tool.
        self.query_result = _FakeSearchResult([])

    async def load_index(self, name, *args, **kwargs):
        self.load_index_calls.append(name)

    async def query(self, index, query, options=None):
        self.query_calls.append((index, query, options))
        return self.query_result

    async def add_docs(self, index, docs, options=None):
        self.add_docs_calls.append((index, docs, options))
        return None


class _FakePublisher:
    def __init__(self) -> None:
        self.published: list[tuple] = []

    async def publish_data(self, payload, reliable=None):
        self.published.append((payload, reliable))


class _FakeRoom:
    def __init__(self) -> None:
        self.local_participant = _FakePublisher()


@pytest.fixture
def stub_moss(monkeypatch):
    """Replace the agent's `MossClient` with the recording fake."""
    monkeypatch.setattr(agent_module, "MossClient", _FakeMossClient)


async def test_search_knowledge_returns_joined_text_and_publishes_context(
    stub_moss,
) -> None:
    """search_knowledge joins snippets and publishes a well-formed payload."""
    room = _FakeRoom()
    assistant = Assistant(room=room, user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult(
        [
            _FakeDoc("First snippet.", score=0.9, metadata={"source": "docs"}),
            _FakeDoc("Second snippet.", score=0.8),
        ],
        time_taken_ms=7.0,
    )

    result = await assistant.search_knowledge(None, "how does turn detection work?")

    # Returns the snippets joined as plain text.
    assert result == "First snippet.\n\nSecond snippet."

    # Queried the knowledge (RAG) index with the user's query.
    assert len(assistant._moss.query_calls) == 1
    index, query, options = assistant._moss.query_calls[0]
    assert index == agent_module.KNOWLEDGE_INDEX
    assert query == "how does turn detection work?"
    assert options.top_k == 3
    # SECURITY: the shared knowledge index MUST be scoped to this user so one
    # user can never retrieve another user's tax document.
    assert options.filter == {
        "field": "user_id",
        "condition": {"$eq": USER_ID},
    }

    # Published exactly one moss_context message, reliably.
    assert len(room.local_participant.published) == 1
    payload_bytes, reliable = room.local_participant.published[0]
    assert reliable is True

    payload = json.loads(payload_bytes.decode("utf-8"))
    assert payload["type"] == "moss_context"
    data = payload["data"]
    # Contractual keys consumed by the frontend parser.
    assert set(data) == {"query", "matches", "time_taken_ms", "timestamp"}
    assert data["query"] == "how does turn detection work?"
    assert data["time_taken_ms"] == 7.0
    assert isinstance(data["timestamp"], (int, float))

    matches = data["matches"]
    assert len(matches) == 2
    assert matches[0]["text"] == "First snippet."
    assert matches[0]["score"] == 0.9
    assert matches[0]["metadata"] == {"source": "docs"}
    assert matches[1]["text"] == "Second snippet."


async def test_remember_fact_adds_doc_with_user_metadata(stub_moss) -> None:
    """remember_fact upserts a memory doc tagged with the caller's user_id."""
    assistant = Assistant(user_id=USER_ID)

    fact = "I am building a drive-thru ordering agent."
    result = await assistant.remember_fact(None, fact)
    assert isinstance(result, str) and result

    assert len(assistant._moss.add_docs_calls) == 1
    index, docs, _options = assistant._moss.add_docs_calls[0]
    assert index == agent_module.MEMORY_INDEX
    assert len(docs) == 1

    doc = docs[0]
    assert doc.text == fact
    assert doc.metadata == {"user_id": USER_ID}
    # Document ids are namespaced by user so writes never collide across users.
    assert doc.id.startswith(f"{USER_ID}-")


async def test_recall_facts_filters_by_user_id(stub_moss) -> None:
    """recall_facts scopes the memory query to the caller via a metadata filter."""
    room = _FakeRoom()
    assistant = Assistant(room=room, user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult(
        [
            _FakeDoc("They are building a drive-thru ordering agent."),
            _FakeDoc("Their name is Alex."),
        ]
    )

    result = await assistant.recall_facts(None, "what am I building?")

    assert result == (
        "They are building a drive-thru ordering agent.\nTheir name is Alex."
    )

    assert len(assistant._moss.query_calls) == 1
    index, query, options = assistant._moss.query_calls[0]
    assert index == agent_module.MEMORY_INDEX
    assert query == "what am I building?"
    assert options.top_k == 5
    # Per-user isolation: the filter must pin user_id to this caller.
    assert options.filter == {
        "field": "user_id",
        "condition": {"$eq": USER_ID},
    }

    # recall_facts also surfaces context to the frontend panel.
    assert len(room.local_participant.published) == 1


async def test_on_enter_preloads_all_indexes(stub_moss) -> None:
    """on_enter warms the knowledge, memory, AND taxcode indexes."""
    assistant = Assistant(user_id=USER_ID)
    await assistant.on_enter()
    assert agent_module.KNOWLEDGE_INDEX in assistant._moss.load_index_calls
    assert agent_module.MEMORY_INDEX in assistant._moss.load_index_calls
    assert agent_module.TAXCODE_INDEX in assistant._moss.load_index_calls


async def test_search_knowledge_no_results_refuses(stub_moss) -> None:
    """No retrieved docs -> the grounded 'not found' message (the refusal beat)."""
    assistant = Assistant(user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult([])
    result = await assistant.search_knowledge(None, "anything")
    assert "No relevant" in result


async def test_recall_facts_no_results(stub_moss) -> None:
    """Empty memory -> a 'nothing remembered' reply, not a fabrication."""
    assistant = Assistant(user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult([])
    result = await assistant.recall_facts(None, "what is my name?")
    assert "don't have anything" in result.lower()


# --- search_taxcode: the cited-retrieval gate ---


async def test_search_taxcode_returns_cited_text_when_above_threshold(
    stub_moss,
) -> None:
    room = _FakeRoom()
    assistant = Assistant(room=room, user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult(
        [
            _FakeDoc("The 2025 standard deduction is 30000 dollars MFJ.", score=0.91),
            _FakeDoc("It is set by Rev. Proc. 2024-40.", score=0.80),
        ]
    )
    result = await assistant.search_taxcode(None, "what is the standard deduction")
    assert "standard deduction is 30000 dollars" in result
    assert "NO_CITATION_FOUND" not in result
    # Queried the taxcode index and surfaced the matches to the panel.
    index, _query, _options = assistant._moss.query_calls[0]
    assert index == agent_module.TAXCODE_INDEX
    assert len(room.local_participant.published) == 1


async def test_search_taxcode_refuses_when_below_threshold(stub_moss) -> None:
    """A weak top match must trip the gate, not let the LLM answer from memory."""
    assistant = Assistant(user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult(
        [_FakeDoc("loosely related", score=0.05)]
    )
    result = await assistant.search_taxcode(None, "can I deduct my dog")
    assert result == agent_module.NO_CITATION_FOUND


async def test_search_taxcode_refuses_when_no_docs(stub_moss) -> None:
    assistant = Assistant(user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult([])
    result = await assistant.search_taxcode(None, "anything obscure")
    assert result == agent_module.NO_CITATION_FOUND


async def test_search_taxcode_passes_when_score_unknown(stub_moss) -> None:
    """If the backend omits scores, the match can't be judged so it passes."""
    assistant = Assistant(user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult(
        [_FakeDoc("cited rule text", score=None)]
    )
    result = await assistant.search_taxcode(None, "a rule")
    assert "cited rule text" in result


# --- concern tracking + the sign-off gate ---


async def test_record_and_resolve_concern(stub_moss) -> None:
    assistant = Assistant(user_id=USER_ID)
    await assistant.record_concern(None, "Why is my refund smaller this year?")
    assert assistant._concerns["Why is my refund smaller this year?"] == "open"
    # A close (substring) match resolves it.
    msg = await assistant.resolve_concern(None, "refund smaller")
    assert assistant._concerns["Why is my refund smaller this year?"] == "resolved"
    assert "resolved" in msg.lower()


async def test_resolve_unknown_concern_is_graceful(stub_moss) -> None:
    assistant = Assistant(user_id=USER_ID)
    msg = await assistant.resolve_concern(None, "something never raised")
    assert "noted" in msg.lower()


async def test_sign_off_blocked_while_concern_open(stub_moss) -> None:
    assistant = Assistant(user_id=USER_ID)
    await assistant.record_concern(None, "I think my state tax looks wrong")
    result = await assistant.sign_off(None)
    assert result.startswith("CANNOT_APPROVE_YET")
    assert assistant._signed_off is False


async def test_sign_off_succeeds_when_clear_and_publishes_and_persists(
    stub_moss,
) -> None:
    room = _FakeRoom()
    assistant = Assistant(room=room, user_id=USER_ID)
    await assistant.record_concern(None, "state tax question")
    await assistant.resolve_concern(None, "state tax question")

    result = await assistant.sign_off(None)
    assert "recorded your approval" in result
    assert assistant._signed_off is True

    # Published an approval data message (distinct type for the frontend card).
    assert len(room.local_participant.published) == 1
    payload = json.loads(room.local_participant.published[0][0].decode("utf-8"))
    assert payload["type"] == "approval"
    assert payload["data"]["approved"] is True
    assert payload["data"]["user_id"] == USER_ID

    # Mirrored the approval to the memory index exactly once, tagged to the user.
    assert len(assistant._moss.add_docs_calls) == 1
    index, docs, _ = assistant._moss.add_docs_calls[0]
    assert index == agent_module.MEMORY_INDEX
    assert docs[0].metadata == {"user_id": USER_ID, "kind": "approval"}


async def test_sign_off_is_idempotent(stub_moss) -> None:
    assistant = Assistant(room=_FakeRoom(), user_id=USER_ID)
    first = await assistant.sign_off(None)
    assert "recorded your approval" in first
    second = await assistant.sign_off(None)
    assert second.startswith("ALREADY_APPROVED")
    # No duplicate memory write on the second call.
    assert len(assistant._moss.add_docs_calls) == 1


async def test_sign_off_without_room_still_records(stub_moss) -> None:
    """No room (e.g. console mode) -> approval still recorded, no publish, no crash."""
    assistant = Assistant(user_id=USER_ID)  # room=None
    result = await assistant.sign_off(None)
    assert assistant._signed_off is True
    assert "recorded your approval" in result
    assert len(assistant._moss.add_docs_calls) == 1


async def test_record_empty_concern_is_noop(stub_moss) -> None:
    assistant = Assistant(user_id=USER_ID)
    msg = await assistant.record_concern(None, "   ")
    assert "nothing to record" in msg.lower()
    assert assistant._concerns == {}


async def test_search_taxcode_refuses_when_matches_are_blank(stub_moss) -> None:
    """Above-threshold but empty-text docs -> still refuse (no real citation)."""
    assistant = Assistant(user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult([_FakeDoc("   ", score=0.95)])
    result = await assistant.search_taxcode(None, "a rule")
    assert result == agent_module.NO_CITATION_FOUND


# --- the sign-off barge-in shield (_disallow_interruptions) ---


class _FakeCtxAllows:
    def __init__(self) -> None:
        self.called = False

    def disallow_interruptions(self) -> None:
        self.called = True


class _FakeCtxAlreadyInterrupted:
    def disallow_interruptions(self) -> None:
        raise RuntimeError("already interrupted")


def test_disallow_interruptions_calls_through() -> None:
    ctx = _FakeCtxAllows()
    agent_module._disallow_interruptions(ctx)
    assert ctx.called is True


def test_disallow_interruptions_swallows_runtime_error() -> None:
    # Already-interrupted turn must not crash the sign-off.
    agent_module._disallow_interruptions(_FakeCtxAlreadyInterrupted())


def test_disallow_interruptions_noop_when_absent() -> None:
    agent_module._disallow_interruptions(None)
    agent_module._disallow_interruptions(object())


async def test_publish_context_omits_missing_score_and_metadata(stub_moss) -> None:
    """A doc with no score/metadata publishes a minimal, well-formed match."""
    room = _FakeRoom()
    assistant = Assistant(room=room, user_id=USER_ID)
    assistant._moss.query_result = _FakeSearchResult(
        [_FakeDoc("plain text", score=None, metadata=None)]
    )
    await assistant.search_knowledge(None, "q")
    payload = json.loads(room.local_participant.published[0][0].decode("utf-8"))
    match = payload["data"]["matches"][0]
    assert match["text"] == "plain text"
    assert "score" not in match
    assert "metadata" not in match
