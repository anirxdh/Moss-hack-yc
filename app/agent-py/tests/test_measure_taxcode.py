"""Unit tests for the taxcode score-calibration helper (offline).

`main()` makes live Moss calls and is pragma-excluded; this exercises the pure
`_top_score` helper and the probe-set wiring so the module is covered without
network or credentials.
"""

import measure_taxcode_scores as m


class _FakeDoc:
    def __init__(self, score) -> None:
        self.score = score


class _FakeResult:
    def __init__(self, docs) -> None:
        self.docs = docs


class _FakeMoss:
    def __init__(self, result) -> None:
        self._result = result
        self.queries: list[tuple] = []

    async def query(self, index, query, options=None):
        self.queries.append((index, query, options))
        return self._result


async def test_top_score_returns_first_doc_score() -> None:
    client = _FakeMoss(_FakeResult([_FakeDoc(0.83), _FakeDoc(0.42)]))
    score = await m._top_score(client, "what is the standard deduction")
    assert score == 0.83
    # Queried the taxcode index for the single best match.
    index, _query, options = client.queries[0]
    assert index == m.TAXCODE_INDEX
    assert options.top_k == 1


async def test_top_score_none_when_no_docs() -> None:
    client = _FakeMoss(_FakeResult([]))
    assert await m._top_score(client, "can I deduct my dog") is None


def test_probe_sets_are_disjoint_and_nonempty() -> None:
    assert m.IN_CORPUS and m.OUT_CORPUS
    assert not (set(m.IN_CORPUS) & set(m.OUT_CORPUS))
