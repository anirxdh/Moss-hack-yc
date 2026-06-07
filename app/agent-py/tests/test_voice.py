"""Unit tests for the TTS wiring (`build_tts`), covering both backends.

MiniMax is the default (sponsor voice); Cartesia is the stable fallback used
when MiniMax creds are absent. Tests are hermetic — they clear MiniMax env so
they don't depend on a local `.env.local`.
"""

import json
import os

import aiohttp
import pytest

import agent as agent_module
import minimax_patch

_TTS_ENV = (
    "TTS_PROVIDER",
    "MINIMAX_TTS_MODEL",
    "MINIMAX_TTS_VOICE",
    "MINIMAX_API_KEY",
    "MINIMAX_GROUP_ID",
    "MINIMAX_BASE_URL",
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


def _minimax_creds(monkeypatch) -> None:
    monkeypatch.setenv("MINIMAX_API_KEY", "test-key")
    monkeypatch.setenv("MINIMAX_GROUP_ID", "test-group")


# --------------------------------------------------------------------------- #
# Backend selection
# --------------------------------------------------------------------------- #
def test_build_tts_default_is_minimax(monkeypatch) -> None:
    """No TTS_PROVIDER + creds present -> MiniMax (the sponsor voice)."""
    _clear(monkeypatch)
    _minimax_creds(monkeypatch)
    monkeypatch.setattr(minimax_patch, "PatchedMinimaxTTS", _SpyTTS)

    tts = agent_module.build_tts()

    assert isinstance(tts, _SpyTTS)
    assert tts.kwargs["model"] == agent_module.DEFAULT_TTS_MODEL
    assert tts.kwargs["voice_id"] == agent_module.DEFAULT_TTS_VOICE


def test_build_tts_minimax_env_overrides(monkeypatch) -> None:
    """MiniMax model/voice are env-overridable."""
    _clear(monkeypatch)
    _minimax_creds(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "minimax")
    monkeypatch.setenv("MINIMAX_TTS_MODEL", "speech-02-hd")
    monkeypatch.setenv("MINIMAX_TTS_VOICE", "presenter_male")
    monkeypatch.setattr(minimax_patch, "PatchedMinimaxTTS", _SpyTTS)

    tts = agent_module.build_tts()

    assert tts.kwargs["model"] == "speech-02-hd"
    assert tts.kwargs["voice_id"] == "presenter_male"


def test_build_tts_minimax_falls_back_to_cartesia_without_creds(monkeypatch) -> None:
    """minimax requested but no creds -> graceful Cartesia fallback (never crashes)."""
    _clear(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "minimax")
    monkeypatch.setattr(agent_module.inference, "TTS", _SpyTTS)

    tts = agent_module.build_tts()

    assert isinstance(tts, _SpyTTS)
    assert tts.kwargs["model"] == agent_module.CARTESIA_TTS_MODEL
    assert tts.kwargs["voice"] == agent_module.CARTESIA_TTS_VOICE


def test_build_tts_cartesia_explicit(monkeypatch) -> None:
    """TTS_PROVIDER=cartesia -> Cartesia even when MiniMax creds exist."""
    _clear(monkeypatch)
    _minimax_creds(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "cartesia")
    monkeypatch.setattr(agent_module.inference, "TTS", _SpyTTS)

    tts = agent_module.build_tts()

    assert isinstance(tts, _SpyTTS)
    assert tts.kwargs["model"] == agent_module.CARTESIA_TTS_MODEL


# --------------------------------------------------------------------------- #
# Real construction (catches signature drift)
# --------------------------------------------------------------------------- #
def test_build_tts_cartesia_constructs_real(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "cartesia")

    tts = agent_module.build_tts()

    assert isinstance(tts, agent_module.inference.TTS)


def test_build_tts_minimax_constructs_real(monkeypatch) -> None:
    """MiniMax path builds a real PatchedMinimaxTTS on the international endpoint."""
    _clear(monkeypatch)
    _minimax_creds(monkeypatch)
    monkeypatch.setenv("TTS_PROVIDER", "minimax")

    tts = agent_module.build_tts()

    assert isinstance(tts, minimax_patch.PatchedMinimaxTTS)
    assert isinstance(tts, minimax_patch.minimax.TTS)
    assert "minimaxi" in tts._opts.base_url  # international, not api.minimax.chat


# --------------------------------------------------------------------------- #
# Endpoint fix (the silent no-audio bug)
# --------------------------------------------------------------------------- #
def test_patched_minimax_defaults_to_international_endpoint(monkeypatch) -> None:
    _clear(monkeypatch)
    _minimax_creds(monkeypatch)

    tts = minimax_patch.PatchedMinimaxTTS(
        model="speech-02-turbo", voice_id="presenter_female"
    )

    assert tts._opts.base_url == minimax_patch.DEFAULT_MINIMAX_BASE_URL
    assert "minimaxi.chat" in tts._opts.base_url


def test_patched_minimax_base_url_env_override(monkeypatch) -> None:
    _clear(monkeypatch)
    _minimax_creds(monkeypatch)
    monkeypatch.setenv("MINIMAX_BASE_URL", "https://custom.example/v1/t2a_v2")

    tts = minimax_patch.PatchedMinimaxTTS(
        model="speech-02-turbo", voice_id="presenter_female"
    )

    assert tts._opts.base_url == "https://custom.example/v1/t2a_v2"


def test_patched_minimax_allows_voice_outside_plugin_literal(monkeypatch) -> None:
    """Newer MiniMax voices (e.g. Calm_Woman) aren't in the stock plugin's voice
    Literal; the patch must accept them by bypassing that validation."""
    _clear(monkeypatch)
    _minimax_creds(monkeypatch)

    tts = minimax_patch.PatchedMinimaxTTS(
        model="speech-02-turbo", voice_id="Calm_Woman"
    )

    assert tts._opts.voice_id == "Calm_Woman"


def test_patched_stream_is_single_segment_subclass() -> None:
    assert issubclass(
        minimax_patch._SingleSegmentStream, minimax_patch.minimax.tts.SynthesizeStream
    )


# --------------------------------------------------------------------------- #
# LIVE proof (network; run with: uv run pytest -m eval)
# --------------------------------------------------------------------------- #
@pytest.mark.eval
async def test_minimax_international_endpoint_streams_audio() -> None:
    """The international endpoint actually returns audio for our creds.

    This is the regression guard for the silent no-audio bug: api.minimax.chat
    returns HTTP 200 with zero audio for international accounts.
    """
    api = os.getenv("MINIMAX_API_KEY")
    gid = os.getenv("MINIMAX_GROUP_ID")
    if not (api and gid):
        pytest.skip("MINIMAX_API_KEY / MINIMAX_GROUP_ID not set")

    from livekit.plugins.minimax.tts import TTSOptions

    opts = TTSOptions(
        api_key=api,
        group_id=gid,
        model="speech-02-turbo",
        voice_id="presenter_female",
        sample_rate=16000,
    )
    opts.base_url = minimax_patch.DEFAULT_MINIMAX_BASE_URL

    audio_bytes = 0
    async with (
        aiohttp.ClientSession() as session,
        session.post(
            opts.get_http_url(),
            json=opts.get_query_params(text="Hello from your AI CPA."),
            headers=opts.get_http_header(),
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp,
    ):
        assert resp.status == 200
        async for chunk in resp.content:
            if chunk[:5] == b"data:":
                obj = json.loads(chunk[5:])
                if "data" in obj and "extra_info" not in obj:
                    audio_bytes += len(bytes.fromhex(obj["data"]["audio"]))

    assert audio_bytes > 0
