"""Unit tests for the TTS wiring (`build_tts`), covering both backends."""

import agent as agent_module
import minimax_patch

_TTS_ENV = (
    "TTS_PROVIDER",
    "MINIMAX_TTS_MODEL",
    "MINIMAX_TTS_VOICE",
    "CARTESIA_TTS_MODEL",
    "CARTESIA_TTS_VOICE",
)


class _SpyTTS:
    """Records constructor kwargs in place of a TTS class."""

    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs


def _clear(monkeypatch) -> None:
    for var in _TTS_ENV:
        monkeypatch.delenv(var, raising=False)


def test_build_tts_default_is_cartesia(monkeypatch) -> None:
    """No TTS_PROVIDER -> stable Cartesia via LiveKit Inference."""
    _clear(monkeypatch)
    monkeypatch.setattr(agent_module.inference, "TTS", _SpyTTS)

    tts = agent_module.build_tts()

    assert isinstance(tts, _SpyTTS)
    assert tts.kwargs["model"] == agent_module.CARTESIA_TTS_MODEL
    assert tts.kwargs["voice"] == agent_module.CARTESIA_TTS_VOICE


def test_build_tts_minimax_uses_patched(monkeypatch) -> None:
    """TTS_PROVIDER=minimax -> the single-segment PatchedMinimaxTTS, with defaults."""
    _clear(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "minimax")
    monkeypatch.setattr(minimax_patch, "PatchedMinimaxTTS", _SpyTTS)

    tts = agent_module.build_tts()

    assert tts.kwargs["model"] == agent_module.DEFAULT_TTS_MODEL
    assert tts.kwargs["voice_id"] == agent_module.DEFAULT_TTS_VOICE


def test_build_tts_minimax_env_overrides(monkeypatch) -> None:
    """MiniMax model/voice are env-overridable."""
    _clear(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "minimax")
    monkeypatch.setenv("MINIMAX_TTS_MODEL", "speech-02-hd")
    monkeypatch.setenv("MINIMAX_TTS_VOICE", "presenter_male")
    monkeypatch.setattr(minimax_patch, "PatchedMinimaxTTS", _SpyTTS)

    tts = agent_module.build_tts()

    assert tts.kwargs["model"] == "speech-02-hd"
    assert tts.kwargs["voice_id"] == "presenter_male"


def test_build_tts_cartesia_constructs_real(monkeypatch) -> None:
    """Default path constructs a real inference.TTS (catches signature drift)."""
    _clear(monkeypatch)

    tts = agent_module.build_tts()

    assert isinstance(tts, agent_module.inference.TTS)


def test_build_tts_minimax_constructs_real(monkeypatch) -> None:
    """MiniMax path constructs a real PatchedMinimaxTTS (a minimax.TTS subclass)."""
    _clear(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "minimax")
    monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("MINIMAX_GROUP_ID", "test-group")

    tts = agent_module.build_tts()

    assert isinstance(tts, minimax_patch.PatchedMinimaxTTS)
    assert isinstance(tts, minimax_patch.minimax.TTS)


def test_patched_stream_is_single_segment_subclass() -> None:
    """The patched TTS hands back our single-segment stream type."""
    assert issubclass(
        minimax_patch._SingleSegmentStream, minimax_patch.minimax.tts.SynthesizeStream
    )
