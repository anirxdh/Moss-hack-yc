"""Typed model + loader for a FINISHED tax return summary.

The AI CPA narrates a return that a human CPA already prepared, so every spoken
number must come from a hand-verified structured fixture — NEVER from fuzzy RAG
chunks and NEVER recomputed by the agent. This module is that single source of
numeric truth.

Design rules (from the eng review):
  * The agent READS these fields; it never does tax math. Year-over-year deltas
    are PRE-COMPUTED here at fixture time, not subtracted live.
  * `refund_or_owed` is signed: positive = refund, negative = balance due. The
    "owed" (negative) path is a first-class case, not an afterthought.
  * Missing OPTIONAL data (states, prior-year) is skipped gracefully; missing a
    REQUIRED field raises ValueError so the caller degrades instead of inventing.

    ReturnSummary
      ├─ refund_or_owed  >= 0 ─▶ "refund of N dollars"
      │                  <  0 ─▶ "you owe N dollars"
      ├─ states[]   (optional) ─▶ per-state refund/owe lines
      └─ yoy        (optional) ─▶ pre-computed deltas + spoken summary
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_RETURN_PATH = AGENT_DIR / "data" / "returns" / "demo_return.json"

_REQUIRED_FIELDS = (
    "tax_year",
    "filing_status",
    "agi",
    "total_tax",
    "total_withholding",
    "refund_or_owed",
)

_FILING_STATUS_SPOKEN = {
    "single": "single",
    "mfj": "married filing jointly",
    "mfs": "married filing separately",
    "hoh": "head of household",
    "qss": "qualifying surviving spouse",
}


def _money(amount: int) -> str:
    """Spoken-friendly dollars: no symbols/commas, always the absolute value."""
    return f"{abs(int(amount))} dollars"


@dataclass
class StateLine:
    """One state's bottom line on a multi-state return."""

    state: str
    refund_or_owed: int  # + refund, - owed
    note: str = ""

    @property
    def is_refund(self) -> bool:
        return self.refund_or_owed >= 0

    def spoken(self) -> str:
        verb = "refund of" if self.is_refund else "you owe"
        base = f"{self.state}: {verb} {_money(self.refund_or_owed)}"
        return f"{base} ({self.note})" if self.note else base


@dataclass
class YoY:
    """Year-over-year comparison — deltas PRE-COMPUTED, never live math."""

    refund_change: int  # this_year.refund_or_owed - last_year.refund_or_owed
    agi_change: int
    summary: str  # plain-language explanation, written at fixture time


@dataclass
class ReturnSummary:
    tax_year: int
    filing_status: str
    agi: int
    total_tax: int
    total_withholding: int
    refund_or_owed: int  # + refund, - owed
    states: list[StateLine] = field(default_factory=list)
    yoy: YoY | None = None

    @property
    def is_refund(self) -> bool:
        return self.refund_or_owed >= 0

    @property
    def is_multistate(self) -> bool:
        return len(self.states) > 1

    def filing_status_spoken(self) -> str:
        return _FILING_STATUS_SPOKEN.get(self.filing_status, self.filing_status)

    def headline(self) -> str:
        """The one-sentence bottom line the walkthrough opens with."""
        if self.is_refund:
            return f"You're getting a federal refund of {_money(self.refund_or_owed)}."
        return f"You owe {_money(self.refund_or_owed)} in federal tax."

    def spoken_summary(self) -> str:
        """Full, TTS-friendly narration the get_return_summary tool returns.

        Only includes the optional state and year-over-year beats when present
        (graceful skip), so a single-year or single-state fixture reads cleanly.
        """
        parts = [
            f"Tax year {self.tax_year}, filing status {self.filing_status_spoken()}.",
            f"Adjusted gross income {_money(self.agi)}.",
            f"Total tax {_money(self.total_tax)}.",
            f"Total withholding {_money(self.total_withholding)}.",
            self.headline(),
        ]
        if self.states:
            lines = "; ".join(s.spoken() for s in self.states)
            parts.append(f"By state: {lines}.")
        if self.yoy is not None:
            parts.append(self.yoy.summary)
        return " ".join(parts)


def _coerce_int(value, field_name: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(
            f"Field '{field_name}' must be an integer, got {value!r}."
        ) from exc


def from_dict(data: dict) -> ReturnSummary:
    """Validate a raw dict into a ReturnSummary (raises ValueError on bad input)."""
    if not isinstance(data, dict):
        raise ValueError("Return summary must be a JSON object.")

    missing = [f for f in _REQUIRED_FIELDS if data.get(f) is None]
    if missing:
        raise ValueError(
            f"Return summary missing required field(s): {', '.join(missing)}."
        )

    states: list[StateLine] = []
    for raw in data.get("states") or []:
        if not isinstance(raw, dict) or raw.get("state") is None:
            continue  # skip malformed state entries rather than invent one
        states.append(
            StateLine(
                state=str(raw["state"]),
                refund_or_owed=_coerce_int(
                    raw.get("refund_or_owed", 0), "state.refund_or_owed"
                ),
                note=str(raw.get("note", "")),
            )
        )

    yoy = None
    raw_yoy = data.get("yoy")
    if isinstance(raw_yoy, dict) and raw_yoy.get("summary"):
        yoy = YoY(
            refund_change=_coerce_int(
                raw_yoy.get("refund_change", 0), "yoy.refund_change"
            ),
            agi_change=_coerce_int(raw_yoy.get("agi_change", 0), "yoy.agi_change"),
            summary=str(raw_yoy["summary"]),
        )

    return ReturnSummary(
        tax_year=_coerce_int(data["tax_year"], "tax_year"),
        filing_status=str(data["filing_status"]),
        agi=_coerce_int(data["agi"], "agi"),
        total_tax=_coerce_int(data["total_tax"], "total_tax"),
        total_withholding=_coerce_int(data["total_withholding"], "total_withholding"),
        refund_or_owed=_coerce_int(data["refund_or_owed"], "refund_or_owed"),
        states=states,
        yoy=yoy,
    )


def load_return_summary(path: Path | None = None) -> ReturnSummary:
    """Load + validate the return-summary fixture (the agent's numeric truth)."""
    path = path or DEFAULT_RETURN_PATH
    if not path.exists():
        raise FileNotFoundError(f"Return summary file not found at {path}.")
    with path.open("r", encoding="utf-8") as handle:
        return from_dict(json.load(handle))
