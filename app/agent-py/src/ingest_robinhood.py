"""Build the user's financial profile from a brokerage snapshot and load it into Moss.

V1 uses a local mock portfolio so the whole pipeline is demoable without any
Robinhood credentials. Swapping in real data later is a single-function change:
replace `load_profile` with a reader for the official Robinhood Trading MCP
(https://agent.robinhood.com/mcp/trading) or a read-only robin_stocks MCP — the
returned dict shape stays the same and everything downstream is unchanged. See
docs/robinhood-financial-profile.md.

Usage:
    uv --directory agent-py run src/ingest_robinhood.py [path/to/portfolio.json]

Reads MOSS_PROJECT_ID / MOSS_PROJECT_KEY (and optional MOSS_INDEX_NAME /
MOSS_MODEL_ID) from agent-py/.env.local.

Coexistence: this APPENDS to the same `knowledge` index the tax ingest builds
(stable doc ids, source="robinhood"), so the agent answers tax *and* portfolio
questions from one index. It never deletes/rebuilds. Because `ingest_tax.py`
*does* rebuild, run the tax ingest first, then this one.

Privacy: prints only counts and metadata (source/type/symbol), never figures or
narrative — so the same code stays safe when real holdings replace the mock data.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from moss import DocumentInfo, MossClient, QueryOptions

AGENT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = AGENT_DIR / ".env.local"
load_dotenv(ENV_PATH)

INDEX_NAME = os.getenv("MOSS_INDEX_NAME", "knowledge")
MODEL_ID = os.getenv("MOSS_MODEL_ID", "moss-minilm")
DEFAULT_PROFILE = AGENT_DIR / "data" / "mock_portfolio.json"
SOURCE = "robinhood"


def _money(value: float) -> str:
    """Format a number as US dollars: 9140.0 -> '$9,140.00'."""
    return f"${value:,.2f}"


def load_profile(path: str | Path = DEFAULT_PROFILE) -> dict:
    """Return the normalized brokerage snapshot.

    SWAP-IN SEAM: today this reads a local mock JSON. To use real data, replace
    the body with a call to the Robinhood Trading MCP or a read-only robin_stocks
    MCP and return the same dict shape: {account, positions[], dividends_ytd,
    realized_gains_ytd, as_of}.
    """
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def build_documents(profile: dict, user_id: str) -> list[DocumentInfo]:
    """Turn a brokerage snapshot into Moss documents (pure; no network).

    One chunk per position plus account / dividend / realized-gain summaries,
    each written as natural language so retrieval and text-to-speech read well.

    Every chunk is tagged with ``user_id`` and given a user-namespaced id, exactly
    like the tax-document seam (``ingest_tax.chunks_to_docs``). Without the tag
    these portfolio docs would sit in the shared ``knowledge`` index untouchable
    by the agent's per-user retrieval filter (and would collide across users on
    their fixed ids). With it, the CPA can ground on THIS user's portfolio only.
    """
    docs: list[DocumentInfo] = []
    as_of = profile.get("as_of", "")
    account = profile.get("account", {})
    positions = profile.get("positions", [])

    # Account summary — computed from positions so the totals are self-consistent.
    invested = sum(p["market_value"] for p in positions)
    cost = sum(p["shares"] * p["avg_cost"] for p in positions)
    cash = account.get("cash", 0.0)
    total = invested + cash
    unrealized = invested - cost
    pct = (unrealized / cost * 100) if cost else 0.0
    acct_type = account.get("type", "brokerage")
    docs.append(
        DocumentInfo(
            id=f"{user_id}-rh-account-summary",
            text=(
                f"Robinhood {acct_type} account summary as of {as_of}: total "
                f"account value {_money(total)}, including {_money(cash)} in cash. "
                f"Holdings are worth {_money(invested)} against a cost basis of "
                f"{_money(cost)}, an unrealized gain of {_money(unrealized)} "
                f"(up {pct:.1f}% over cost)."
            ),
            metadata={"user_id": user_id, "source": SOURCE, "type": "account_summary"},
        )
    )

    # One document per holding.
    for p in positions:
        gain = p["market_value"] - p["shares"] * p["avg_cost"]
        gpct = abs(p.get("unrealized_gain_pct", 0.0))
        change = (
            f"an unrealized gain of {_money(gain)} (up {gpct:.1f}%)"
            if gain >= 0
            else f"an unrealized loss of {_money(-gain)} (down {gpct:.1f}%)"
        )
        docs.append(
            DocumentInfo(
                id=f"{user_id}-rh-position-{p['symbol']}",
                text=(
                    f"You hold {p['shares']} shares of {p['name']} ({p['symbol']}) "
                    f"in your Robinhood account. Average cost {_money(p['avg_cost'])} "
                    f"per share, current price {_money(p['current_price'])}, market "
                    f"value {_money(p['market_value'])} — {change}."
                ),
                metadata={
                    "user_id": user_id,
                    "source": SOURCE,
                    "type": "position",
                    "symbol": p["symbol"],
                },
            )
        )

    # Dividends (taxable income -> 1099-DIV).
    divs = profile.get("dividends_ytd", [])
    if divs:
        div_total = sum(d["amount"] for d in divs)
        listing = ", ".join(f"{d['name']} {_money(d['amount'])}" for d in divs)
        docs.append(
            DocumentInfo(
                id=f"{user_id}-rh-dividends",
                text=(
                    f"Dividends received so far this year total {_money(div_total)} "
                    f"across your Robinhood holdings: {listing}. Dividends are taxable "
                    f"income and are reported on a 1099-DIV."
                ),
                metadata={"user_id": user_id, "source": SOURCE, "type": "dividends"},
            )
        )

    # Realized capital gains (-> 1099-B).
    rg = profile.get("realized_gains_ytd")
    if rg:
        docs.append(
            DocumentInfo(
                id=f"{user_id}-rh-realized-gains",
                text=(
                    f"Realized capital gains so far this year total "
                    f"{_money(rg['total'])} in your Robinhood account: "
                    f"{_money(rg['short_term'])} short-term (taxed as ordinary "
                    f"income) and {_money(rg['long_term'])} long-term (lower "
                    f"long-term capital-gains rate). Reported on a 1099-B."
                ),
                metadata={
                    "user_id": user_id,
                    "source": SOURCE,
                    "type": "realized_gains",
                },
            )
        )

    return docs


async def main() -> None:
    profile_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROFILE
    project_id = os.getenv("MOSS_PROJECT_ID")
    project_key = os.getenv("MOSS_PROJECT_KEY")
    if not (project_id and project_key):
        raise SystemExit("MOSS_PROJECT_ID / MOSS_PROJECT_KEY missing from .env.local")
    if not Path(profile_path).exists():
        raise SystemExit(f"Profile not found: {profile_path}")

    # The portfolio belongs to a specific user — tag it with the same id the
    # frontend uses (set INGEST_USER_ID to the Clerk user) so the agent's
    # per-user retrieval filter can reach it. Defaults to the demo user.
    user_id = os.getenv("INGEST_USER_ID", "user_1")
    print(
        f"[1/2] Building financial-profile docs from {Path(profile_path).name} "
        f"for user '{user_id}'"
    )
    profile = load_profile(profile_path)
    docs = build_documents(profile, user_id)
    by_type: dict[str, int] = {}
    for d in docs:
        by_type[d.metadata["type"]] = by_type.get(d.metadata["type"], 0) + 1
    print(f"      prepared {len(docs)} docs: {by_type}")

    client = MossClient(project_id, project_key)
    print(f"[2/2] Appending to Moss index '{INDEX_NAME}' (coexists with tax docs)")
    try:
        await client.add_docs(INDEX_NAME, docs)
        print("      add_docs OK (appended)")
    except Exception as exc:
        print(f"      add_docs failed ({type(exc).__name__}); creating index fresh")
        await client.create_index(INDEX_NAME, docs, MODEL_ID)
        print("      created index with profile docs")

    # Smoke query — counts + metadata only (no figures/advice printed).
    print("Verifying retrieval...")
    try:
        await client.load_index(INDEX_NAME)
        r = await client.query(
            INDEX_NAME,
            "portfolio value, unrealized gains, and dividends",
            QueryOptions(top_k=4),
        )
        rdocs = getattr(r, "docs", None) or []
        tags = [
            (
                (getattr(d, "metadata", {}) or {}).get("source"),
                (getattr(d, "metadata", {}) or {}).get("type"),
                (getattr(d, "metadata", {}) or {}).get("symbol"),
            )
            for d in rdocs
        ]
        print(
            f"  retrieval OK: {len(rdocs)} hits, "
            f"time_taken_ms={getattr(r, 'time_taken_ms', None)}, tags={tags}"
        )
    except Exception as exc:
        print(f"  smoke query warning: {type(exc).__name__}")
    print("DONE. The 'knowledge' index now also holds your financial profile.")


if __name__ == "__main__":
    asyncio.run(main())
