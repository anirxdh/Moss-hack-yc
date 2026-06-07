"""Single-segment patch for livekit-plugins-minimax 1.2.9.

The stock plugin opens a new audio *segment* per sentence within one TTS turn,
which crashes under livekit-agents 1.5.x on multi-sentence replies:

    RuntimeError: start_segment() called before the previous segment was ended

This subclass emits exactly ONE segment per turn (every sentence's audio is
pushed into that single segment), which structurally avoids the crash. Use
``PatchedMinimaxTTS`` exactly like ``minimax.TTS``.

If a future livekit-plugins-minimax release fixes this upstream, delete this
file and switch ``build_tts`` back to ``minimax.TTS``.
"""

from __future__ import annotations

import json
import os

import aiohttp
from livekit.agents import tts, utils
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from livekit.plugins import minimax
from osc_data.text_stream import TextStreamSentencizer


class _SingleSegmentStream(minimax.tts.SynthesizeStream):
    """MiniMax synthesis that uses a single audio segment for the whole turn.

    Mirrors the upstream ``_run`` but moves ``start_segment``/``end_segment``
    outside the per-sentence loop so only one segment is ever open.
    """

    async def _run(self, emitter: tts.AudioEmitter) -> None:  # pragma: no cover  (network streaming; integration-tested live)
        emitter.initialize(
            request_id=utils.shortuuid(),
            sample_rate=self._opts.sample_rate,
            mime_type="audio/pcm",
            stream=True,
            num_channels=1,
        )
        emitter.start_segment(segment_id=utils.shortuuid())
        splitter = TextStreamSentencizer()
        async for token in self._input_ch:
            if isinstance(token, self._FlushSentinel):
                sentences = splitter.flush()
            else:
                sentences = splitter.push(text=token)
            for sentence in sentences:
                if len(sentence.strip()) == 0:
                    continue
                params = self._opts.get_query_params(text=sentence)
                async with self._session.post(
                    self._opts.get_http_url(),
                    json=params,
                    timeout=aiohttp.ClientTimeout(
                        total=300, sock_connect=self._conn_options.timeout
                    ),
                    headers=self._opts.get_http_header(),
                ) as resp:
                    resp.raise_for_status()
                    resp.content._high_water = resp.content._high_water**2
                    async for chunk in resp.content:
                        if chunk[:5] == b"data:":
                            obj = json.loads(chunk[5:])
                            if "data" in obj and "extra_info" not in obj:
                                emitter.push(bytes.fromhex(obj["data"]["audio"]))
                self._pushed_text = self._pushed_text.replace(sentence, "")
        emitter.end_segment()


# The stock plugin hardcodes api.minimax.chat — MiniMax's CHINA endpoint, which
# returns HTTP 200 with ZERO audio for international accounts. International
# accounts must use api.minimaxi.chat (note the extra "i"). Override via
# MINIMAX_BASE_URL if your account lives on a different host.
DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.chat/v1/t2a_v2"


class PatchedMinimaxTTS(minimax.TTS):
    """MiniMax TTS that targets the international endpoint and emits one audio
    segment per turn (multi-sentence safe)."""

    def __init__(self, *args, base_url: str | None = None, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._opts.base_url = (
            base_url or os.environ.get("MINIMAX_BASE_URL") or DEFAULT_MINIMAX_BASE_URL
        )

    def stream(
        self, *, conn_options=DEFAULT_API_CONNECT_OPTIONS
    ) -> _SingleSegmentStream:
        return _SingleSegmentStream(
            tts=self,
            conn_options=conn_options,
            opts=self._opts,
            session=self._ensure_session(),
        )
