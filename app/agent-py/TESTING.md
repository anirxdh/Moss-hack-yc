# Testing

How the AI CPA agent is tested, and how to run it.

## Test layout

| File | Covers |
|------|--------|
| `tests/test_moss.py` | The 3 Moss tools (`search_knowledge` / `remember_fact` / `recall_facts`), `on_enter` index preload, the `moss_context` payload shape, and the refuse-when-empty behavior |
| `tests/test_voice.py` | `build_tts` backend selection (Cartesia default, MiniMax patched), env overrides, real construction |
| `tests/test_llm.py` | `build_llm` model / provider / gateway env wiring (Qwen-ready) |
| `tests/test_ingest_tax.py` | Unsiloed → Moss ingest: `submit_parse` / `poll_job` / `chunks_to_docs` + `main()`, with mocked HTTP and Moss |
| `tests/test_create_index.py` | The Moss index builder (`knowledge` + `memory`) |
| `tests/test_robinhood.py` | Financial-profile document building |
| `tests/test_ingest_robinhood_main.py` | Financial-profile ingest CLI flow (`main()`) |
| `tests/test_agent.py` | **LLM-judged evals** — greeting, grounding/refusal, harmful-refusal. Marked `eval`; network-bound. |

## Running

```bash
cd agent-py

# Fast, offline unit suite (default — excludes the network-bound LLM evals):
uv run pytest

# Same, with the coverage gate (fails the run if under 95%):
uv run pytest --cov=src

# The LLM-judged evals only (needs LiveKit Inference / network; costs tokens):
uv run pytest -m eval
```

The `eval` exclusion is the default (`addopts = "-m 'not eval'"` in `pyproject.toml`), so the everyday loop and CI stay fast and offline.

## Coverage

- The offline unit suite covers **~96% of `src/`**; the gate is **95%** (`pyproject.toml` → `[tool.coverage.report] fail_under`).
- The small remainder is **integration glue** that is validated by running the agent live, not by unit tests, and is marked `# pragma: no cover`:
  - `agent.py::my_agent` — the LiveKit worker entrypoint (session wiring, connect, greeting)
  - `agent.py::prewarm` — loads the Silero VAD model
  - `minimax_patch.py::_run` — the streaming HTTP synthesis loop
- `if __name__ == "__main__":` blocks are excluded globally.

## Conventions

- New offline tests must keep the suite **green and the gate ≥95%**.
- Anything that hits the network live (LLM / STT / TTS / Moss / Unsiloed) goes behind the `eval` marker or is mocked.
- When changing agent instructions, tools, or the voice/LLM wiring, add or adjust tests first (TDD) — see `AGENTS.md`.
