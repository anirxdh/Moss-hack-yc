"""Unit tests for the optional avatar wiring (`build_avatar`).

The avatar is off by default and must degrade to voice-only (return None) when
disabled, when creds are missing, or for an unknown provider — so a live demo
never hard-fails on the avatar.
"""

import agent as agent_module

_AVATAR_ENV = (
    "AVATAR_PROVIDER",
    "TAVUS_API_KEY",
    "TAVUS_REPLICA_ID",
    "TAVUS_PERSONA_ID",
    "SIMLI_API_KEY",
    "SIMLI_FACE_ID",
    "SIMLI_EMOTION_ID",
)


class _SpyAvatar:
    """Records constructor kwargs in place of tavus.AvatarSession."""

    def __init__(self, **kwargs) -> None:
        self.kwargs = kwargs


def _clear(monkeypatch) -> None:
    for var in _AVATAR_ENV:
        monkeypatch.delenv(var, raising=False)


def test_build_avatar_default_is_none(monkeypatch) -> None:
    """No AVATAR_PROVIDER -> voice-only."""
    _clear(monkeypatch)
    assert agent_module.build_avatar() is None


def test_build_avatar_off_is_none(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "none")
    assert agent_module.build_avatar() is None


def test_build_avatar_tavus_without_key_falls_back_to_voice(monkeypatch) -> None:
    """tavus requested but no TAVUS_API_KEY -> voice-only (no crash)."""
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "tavus")
    assert agent_module.build_avatar() is None


def test_build_avatar_unknown_provider_is_none(monkeypatch) -> None:
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "hologram")
    assert agent_module.build_avatar() is None


def test_build_avatar_tavus_with_creds(monkeypatch) -> None:
    """tavus + creds -> a Tavus AvatarSession built with the replica/persona."""
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "tavus")
    monkeypatch.setenv("TAVUS_API_KEY", "k")
    monkeypatch.setenv("TAVUS_REPLICA_ID", "r1")
    monkeypatch.setenv("TAVUS_PERSONA_ID", "p1")
    from livekit.plugins import tavus

    monkeypatch.setattr(tavus, "AvatarSession", _SpyAvatar)

    avatar = agent_module.build_avatar()

    assert isinstance(avatar, _SpyAvatar)
    assert avatar.kwargs["replica_id"] == "r1"
    assert avatar.kwargs["persona_id"] == "p1"


async def test_build_avatar_tavus_constructs_real(monkeypatch) -> None:
    """Real Tavus AvatarSession constructs (catches plugin signature drift).

    The plugin creates an aiohttp session at construct, which requires an active
    http context (no network call happens until ``start()``).
    """
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "tavus")
    monkeypatch.setenv("TAVUS_API_KEY", "k")
    monkeypatch.setenv("TAVUS_REPLICA_ID", "r1")
    monkeypatch.setenv("TAVUS_PERSONA_ID", "p1")
    from livekit.agents import utils
    from livekit.plugins import tavus

    async with utils.http_context.open():
        avatar = agent_module.build_avatar()

    assert isinstance(avatar, tavus.AvatarSession)


# --------------------------------------------------------------------------- #
# Simli backend
# --------------------------------------------------------------------------- #
def test_build_avatar_simli_without_creds_falls_back(monkeypatch) -> None:
    """simli requested but no SIMLI_API_KEY/SIMLI_FACE_ID -> voice-only."""
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "simli")
    assert agent_module.build_avatar() is None


def test_build_avatar_simli_with_creds(monkeypatch) -> None:
    """simli + creds -> a Simli AvatarSession built from SimliConfig(face_id...)."""
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "simli")
    monkeypatch.setenv("SIMLI_API_KEY", "k")
    monkeypatch.setenv("SIMLI_FACE_ID", "f1")
    monkeypatch.setenv("SIMLI_EMOTION_ID", "e1")
    from livekit.plugins import simli

    monkeypatch.setattr(simli, "AvatarSession", _SpyAvatar)

    avatar = agent_module.build_avatar()

    assert isinstance(avatar, _SpyAvatar)
    assert avatar.kwargs["simli_config"].face_id == "f1"
    assert avatar.kwargs["simli_config"].emotion_id == "e1"


async def test_build_avatar_simli_constructs_real(monkeypatch) -> None:
    """Real Simli AvatarSession constructs (catches plugin signature drift)."""
    _clear(monkeypatch)
    monkeypatch.setenv("AVATAR_PROVIDER", "simli")
    monkeypatch.setenv("SIMLI_API_KEY", "k")
    monkeypatch.setenv("SIMLI_FACE_ID", "f1")
    from livekit.agents import utils
    from livekit.plugins import simli

    async with utils.http_context.open():
        avatar = agent_module.build_avatar()

    assert isinstance(avatar, simli.AvatarSession)


# --------------------------------------------------------------------------- #
# Frontend on/off toggle (dispatch metadata "avatar")
# --------------------------------------------------------------------------- #
def test_avatar_enabled_defaults_true_when_unset() -> None:
    assert agent_module._avatar_enabled({}) is True


def test_avatar_enabled_respects_false_bool() -> None:
    assert agent_module._avatar_enabled({"avatar": False}) is False


def test_avatar_enabled_respects_string_flags() -> None:
    assert agent_module._avatar_enabled({"avatar": "true"}) is True
    assert agent_module._avatar_enabled({"avatar": "false"}) is False
    assert agent_module._avatar_enabled({"avatar": "off"}) is False
