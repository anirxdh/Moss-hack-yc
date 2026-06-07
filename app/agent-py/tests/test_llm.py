"""Unit tests for the LLM wiring (`build_llm`).

Covers the env-driven switch points we'll use to move to Qwen (provider override
or a gateway base_url) without touching code. Uses a spy plus a real-construct
test so plugin signature drift is caught.
"""

import agent as agent_module

_LLM_ENV = ("LLM_MODEL", "LLM_PROVIDER", "LLM_BASE_URL", "LLM_API_KEY")


class _SpyLLM:
    """Records constructor args in place of `inference.LLM`."""

    def __init__(self, model, **kwargs) -> None:
        self.model = model
        self.kwargs = kwargs


def _clear(monkeypatch) -> None:
    for var in _LLM_ENV:
        monkeypatch.delenv(var, raising=False)


def test_build_llm_default(monkeypatch) -> None:
    """No overrides -> default model via LiveKit Inference, no extra kwargs."""
    _clear(monkeypatch)
    monkeypatch.setattr(agent_module.inference, "LLM", _SpyLLM)

    llm = agent_module.build_llm()

    assert llm.model == agent_module.DEFAULT_LLM_MODEL
    assert "provider" not in llm.kwargs
    assert "base_url" not in llm.kwargs


def test_build_llm_qwen_via_provider(monkeypatch) -> None:
    """Qwen path #1: model + provider override (e.g. Cerebras on Inference)."""
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_MODEL", "qwen-3-235b-instruct")
    monkeypatch.setenv("LLM_PROVIDER", "cerebras")
    monkeypatch.setattr(agent_module.inference, "LLM", _SpyLLM)

    llm = agent_module.build_llm()

    assert llm.model == "qwen-3-235b-instruct"
    assert llm.kwargs["provider"] == "cerebras"
    assert "base_url" not in llm.kwargs


def test_build_llm_via_gateway(monkeypatch) -> None:
    """Qwen path #2: route through a gateway (e.g. TrueFoundry) base_url + key."""
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_MODEL", "qwen-max")
    monkeypatch.setenv("LLM_BASE_URL", "https://gateway.example/v1")
    monkeypatch.setenv("LLM_API_KEY", "tf-key")
    monkeypatch.setattr(agent_module.inference, "LLM", _SpyLLM)

    llm = agent_module.build_llm()

    assert llm.model == "qwen-max"
    assert llm.kwargs["base_url"] == "https://gateway.example/v1"
    assert llm.kwargs["api_key"] == "tf-key"
    assert "provider" not in llm.kwargs


def test_build_llm_constructs_real(monkeypatch) -> None:
    """Real construction (no spy) catches signature drift in inference.LLM."""
    _clear(monkeypatch)

    llm = agent_module.build_llm()

    assert isinstance(llm, agent_module.inference.LLM)
