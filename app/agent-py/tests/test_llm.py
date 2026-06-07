"""Unit tests for the LLM wiring (`build_llm`).

Two paths:
  - default: LiveKit Inference (optionally with a provider override, e.g. Qwen).
  - gateway: an OpenAI-compatible endpoint (TrueFoundry governance / Qwen
    DashScope) via the openai plugin, with optional X-TFY-* headers for PII
    redaction, dashboard metadata, and voice failover.

Spies + real-construct tests catch plugin signature drift.
"""

import os

import pytest
from livekit.plugins import openai as lk_openai

import agent as agent_module

_LLM_ENV = (
    "LLM_MODEL",
    "LLM_PROVIDER",
    "LLM_BASE_URL",
    "LLM_API_KEY",
    "TRUEFOUNDRY_GUARDRAILS",
    "TRUEFOUNDRY_METADATA",
    "TRUEFOUNDRY_TTFT_TIMEOUT_MS",
    "QWEN_API_KEY",
    "QWEN_MODEL",
    "QWEN_BASE_URL",
)


class _SpyLLM:
    """Records constructor args in place of inference.LLM."""

    def __init__(self, model, **kwargs) -> None:
        self.model = model
        self.kwargs = kwargs


class _SpyOpenAILLM:
    """Records constructor kwargs in place of openai.LLM (keyword-only)."""

    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs


def _clear(monkeypatch) -> None:
    for var in _LLM_ENV:
        monkeypatch.delenv(var, raising=False)


# --------------------------------------------------------------------------- #
# Default path: LiveKit Inference
# --------------------------------------------------------------------------- #
def test_build_llm_default(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setattr(agent_module.inference, "LLM", _SpyLLM)

    llm = agent_module.build_llm()

    assert llm.model == agent_module.DEFAULT_LLM_MODEL
    assert "provider" not in llm.kwargs


def test_build_llm_qwen_via_provider(monkeypatch) -> None:
    """Qwen path #1: model + provider override on LiveKit Inference."""
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_MODEL", "qwen-3-235b-instruct")
    monkeypatch.setenv("LLM_PROVIDER", "cerebras")
    monkeypatch.setattr(agent_module.inference, "LLM", _SpyLLM)

    llm = agent_module.build_llm()

    assert llm.model == "qwen-3-235b-instruct"
    assert llm.kwargs["provider"] == "cerebras"


# --------------------------------------------------------------------------- #
# Gateway path: TrueFoundry / Qwen DashScope via the openai plugin
# --------------------------------------------------------------------------- #
def test_build_llm_gateway_uses_openai_plugin(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_MODEL", "openai-main/gpt-4o-mini")
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.truefoundry.ai")
    monkeypatch.setenv("LLM_API_KEY", "tfy-key")
    monkeypatch.setattr(lk_openai, "LLM", _SpyOpenAILLM)

    llm = agent_module.build_llm()

    assert isinstance(llm, _SpyOpenAILLM)
    assert llm.kwargs["model"] == "openai-main/gpt-4o-mini"
    assert llm.kwargs["base_url"] == "https://gateway.truefoundry.ai"
    assert llm.kwargs["api_key"] == "tfy-key"


def test_build_llm_gateway_applies_pii_guardrail_header(monkeypatch) -> None:
    """The PII guardrail reaches the gateway as the X-TFY-GUARDRAILS header."""
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.truefoundry.ai")
    monkeypatch.setenv("LLM_API_KEY", "tfy-key")
    monkeypatch.setenv(
        "TRUEFOUNDRY_GUARDRAILS",
        '{"llm_input_guardrails":["grp/tfy-pii"],"llm_output_guardrails":["grp/tfy-pii"]}',
    )
    monkeypatch.setattr(lk_openai, "LLM", _SpyOpenAILLM)

    headers = agent_module.build_llm().kwargs["extra_headers"]

    assert "grp/tfy-pii" in headers["X-TFY-GUARDRAILS"]


def test_build_llm_gateway_adds_metadata_and_ttft(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.truefoundry.ai")
    monkeypatch.setenv("TRUEFOUNDRY_METADATA", '{"feature":"voice"}')
    monkeypatch.setenv("TRUEFOUNDRY_TTFT_TIMEOUT_MS", "1500")
    monkeypatch.setattr(lk_openai, "LLM", _SpyOpenAILLM)

    headers = agent_module.build_llm().kwargs["extra_headers"]

    assert headers["X-TFY-METADATA"] == '{"feature":"voice"}'
    assert headers["x-tfy-ttft-timeout-ms"] == "1500"


def test_build_llm_gateway_no_headers_when_unset(monkeypatch) -> None:
    """No governance env -> no extra_headers kwarg at all."""
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.truefoundry.ai")
    monkeypatch.setattr(lk_openai, "LLM", _SpyOpenAILLM)

    assert "extra_headers" not in agent_module.build_llm().kwargs


# --------------------------------------------------------------------------- #
# Real construction (catches signature drift)
# --------------------------------------------------------------------------- #
def test_build_llm_default_constructs_real(monkeypatch) -> None:
    _clear(monkeypatch)

    llm = agent_module.build_llm()

    assert isinstance(llm, agent_module.inference.LLM)


def test_build_llm_gateway_constructs_real(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_MODEL", "openai-main/gpt-4o-mini")
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.truefoundry.ai")
    monkeypatch.setenv("LLM_API_KEY", "dummy")
    monkeypatch.setenv(
        "TRUEFOUNDRY_GUARDRAILS", '{"llm_output_guardrails":["grp/tfy-pii"]}'
    )

    llm = agent_module.build_llm()

    assert isinstance(llm, lk_openai.LLM)


# --------------------------------------------------------------------------- #
# Qwen direct (DashScope) via QWEN_API_KEY
# --------------------------------------------------------------------------- #
def test_build_llm_qwen_direct(monkeypatch) -> None:
    """QWEN_API_KEY -> Qwen via DashScope (openai plugin), no gateway needed."""
    _clear(monkeypatch)
    monkeypatch.setenv("QWEN_API_KEY", "qwen-key")
    monkeypatch.setattr(lk_openai, "LLM", _SpyOpenAILLM)

    llm = agent_module.build_llm()

    assert isinstance(llm, _SpyOpenAILLM)
    assert llm.kwargs["api_key"] == "qwen-key"
    assert "dashscope" in llm.kwargs["base_url"]
    assert llm.kwargs["model"] == agent_module.DEFAULT_QWEN_MODEL


def test_build_llm_qwen_model_and_endpoint_override(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("QWEN_API_KEY", "qwen-key")
    monkeypatch.setenv("QWEN_MODEL", "qwen-max")
    monkeypatch.setenv(
        "QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    monkeypatch.setattr(lk_openai, "LLM", _SpyOpenAILLM)

    llm = agent_module.build_llm()

    assert llm.kwargs["model"] == "qwen-max"
    assert llm.kwargs["base_url"] == "https://dashscope.aliyuncs.com/compatible-mode/v1"


def test_build_llm_gateway_takes_precedence_over_qwen(monkeypatch) -> None:
    """Both LLM_BASE_URL and QWEN_API_KEY set -> the explicit gateway wins."""
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.truefoundry.ai")
    monkeypatch.setenv("LLM_API_KEY", "tfy")
    monkeypatch.setenv("QWEN_API_KEY", "qwen-key")
    monkeypatch.setattr(lk_openai, "LLM", _SpyOpenAILLM)

    llm = agent_module.build_llm()

    assert llm.kwargs["base_url"] == "https://gateway.truefoundry.ai"
    assert llm.kwargs["api_key"] == "tfy"


def test_build_llm_qwen_constructs_real(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("QWEN_API_KEY", "qwen-key")

    llm = agent_module.build_llm()

    assert isinstance(llm, lk_openai.LLM)


# --------------------------------------------------------------------------- #
# LIVE proof (network; run with: uv run pytest -m eval)
# --------------------------------------------------------------------------- #
@pytest.mark.eval
async def test_truefoundry_gateway_reachable() -> None:
    """A chat completion routes through the configured gateway.

    Skips unless LLM_BASE_URL / LLM_API_KEY / LLM_MODEL are set, so it only runs
    once TrueFoundry (or another gateway) is wired up. Regression guard for the
    governed LLM path.
    """
    base_url = os.getenv("LLM_BASE_URL")
    api_key = os.getenv("LLM_API_KEY")
    model = os.getenv("LLM_MODEL")
    if not (base_url and api_key and model):
        pytest.skip("LLM_BASE_URL / LLM_API_KEY / LLM_MODEL not set")

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    resp = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Say hi in one word."}],
        max_tokens=10,
    )
    assert resp.choices[0].message.content
