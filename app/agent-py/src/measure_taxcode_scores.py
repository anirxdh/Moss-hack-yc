"""Calibrate the NO_CITATION_FOUND score threshold for the taxcode index.

Step 2 of the build. The cited-retrieval gate (search_taxcode) must refuse to
answer when the top Moss match is too weak to be a real citation. To pick that
cutoff you need to SEE the score distribution on the real corpus — guessing a
number produces a gate that either refuses good questions or never refuses.

This script loads the live `taxcode` index and runs two probe sets:

    IN-CORPUS   questions the corpus SHOULD answer  -> expect HIGH top scores
    OUT-CORPUS  questions the corpus should NOT      -> expect LOW top scores

Pick a threshold in the gap between the two clusters (e.g. a touch below the
lowest IN-CORPUS top score). Wire it into agent.py as TAXCODE_MIN_SCORE.

    PREREQ: build the index first ->  pnpm moss:index   (or
            uv --directory agent-py run src/create_index.py)
    RUN:    uv --directory agent-py run src/measure_taxcode_scores.py

Needs MOSS_PROJECT_ID / MOSS_PROJECT_KEY (+ optional MOSS_TAXCODE_INDEX_NAME)
in agent-py/.env.local. Prints only the query text and scores — no PII.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from moss import MossClient, QueryOptions

AGENT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(AGENT_DIR / ".env.local")

TAXCODE_INDEX = os.getenv("MOSS_TAXCODE_INDEX_NAME", "taxcode")

# Questions a finished-return walkthrough will actually hit — should retrieve
# a strong citation from the corpus.
IN_CORPUS = [
    "what is the standard deduction for married filing jointly",
    "why am I getting such a big refund",
    "what is the difference between short term and long term capital gains",
    "how much is the child tax credit",
    "what tax bracket am I in",
    "how is my refund calculated",
    "what is the California capital gains tax rate",
    "do I owe New York City income tax",
    "I moved states this year, do I file two returns",
    "what is the SALT deduction cap",
]

# Questions the corpus deliberately does NOT cover — the gate should refuse and
# offer to flag for the CPA rather than letting the LLM answer from memory.
OUT_CORPUS = [
    "can I claim my dog as a dependent",
    "how do I form an S corporation in Delaware",
    "what is the federal estate tax exemption this year",
    "how are crypto staking rewards taxed",
    "explain the foreign tax credit on form 1116",
]


async def _top_score(client: MossClient, query: str) -> float | None:
    result = await client.query(TAXCODE_INDEX, query, QueryOptions(top_k=1))
    docs = getattr(result, "docs", None) or []
    if not docs:
        return None
    return getattr(docs[0], "score", None)


async def main() -> None:  # pragma: no cover (live Moss calls; run manually)
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    if not project_id or not project_key:
        raise OSError(
            "Set MOSS_PROJECT_ID and MOSS_PROJECT_KEY in agent-py/.env.local first."
        )

    client = MossClient(project_id, project_key)
    await client.load_index(TAXCODE_INDEX)

    print(f"Index: {TAXCODE_INDEX}\n")
    print("IN-CORPUS (expect HIGH top score):")
    in_scores: list[float] = []
    for q in IN_CORPUS:
        s = await _top_score(client, q)
        if s is not None:
            in_scores.append(s)
        print(f"  {s if s is None else round(s, 4)!s:<8}  {q}")

    print("\nOUT-OF-CORPUS (expect LOW top score):")
    out_scores: list[float] = []
    for q in OUT_CORPUS:
        s = await _top_score(client, q)
        if s is not None:
            out_scores.append(s)
        print(f"  {s if s is None else round(s, 4)!s:<8}  {q}")

    if in_scores and out_scores:
        lo_in = min(in_scores)
        hi_out = max(out_scores)
        print(
            f"\nlowest IN-corpus  top score = {round(lo_in, 4)}"
            f"\nhighest OUT-corpus top score = {round(hi_out, 4)}"
        )
        if lo_in > hi_out:
            suggested = round((lo_in + hi_out) / 2, 4)
            print(
                f"\nSuggested TAXCODE_MIN_SCORE ~= {suggested}  (midpoint of the gap)"
            )
        else:
            print(
                "\nWARNING: clusters OVERLAP — no clean cutoff. Consider a stronger "
                "embedding model (moss-mediumlm), more corpus chunks, or hybrid alpha."
            )


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
