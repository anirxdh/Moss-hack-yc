# MiniMax — Cheap + Fast Multimodal Intelligence (TTS, Voice Clone, LLM, Music, Video)

> Report for the Conversational AI Hackathon 2026 (Moss / YC SF, Jun 6–7). Source of truth: local raw docs `raw/mm-llms.txt` (index) + `raw/mm-llms-full.txt` (~610KB full dump). All endpoints, params, model IDs, prices, and code are transcribed verbatim from those docs.

---

## What is MiniMax in one paragraph

MiniMax is a single-API-key platform that exposes a full stack of **cheap, fast generative models** behind one base URL (`https://api.minimax.io`): a frontier **LLM** family (MiniMax‑M3 with a **1,000,000‑token** context window, plus the M2.x series) served over **Anthropic-compatible** *and* **OpenAI-compatible** endpoints (drop-in: just swap `base_url`); a best-in-class **Text-to-Speech (T2A)** engine (`speech-2.8-hd`/`speech-2.8-turbo`) with **300+ system voices, 40 languages, 7 emotions, sound-tags**, available **synchronous HTTP, streaming WebSocket, and async long-form** (up to 1M chars); **rapid voice cloning** from a 10s–5min sample (one API call → reusable `voice_id`); **Voice Design** (describe a voice in text → get a custom `voice_id`); plus **music generation** (full songs with lyrics + covers), **video generation** (Hailuo 2.3, text/image/first-last-frame/subject-reference), and **image generation**. It also supports **Anthropic-style explicit prompt caching** (`cache_control`) to cut LLM cost/latency, and ships official **Python/JS MCP servers**.

## Why it matters for a voice-AI hackathon (and which tracks)

Voice agents are TTS + LLM + transport. MiniMax gives you the two cheapest+best halves in one place:

- **TTS for the agent's mouth** — `speech-2.8-turbo` ($60/M chars) streams over WebSocket with low time-to-first-audio, supports 40 languages and 7 emotions. This is your **LiveKit TTS provider**. Serves **all three tracks** (Lead Gen / Support / Co-Pilot) since every voice agent needs to talk.
- **Voice cloning = the wow factor** — clone the founder's / a customer's voice from a 30-second clip and have the agent speak in it. Huge demo moment for **Lead Gen** ("the AE's own voice calls the lead back") and **Support** ("brand voice").
- **Cheap LLM for the cost story** — MiniMax-M3 input at **$0.30/M tokens** (≤512k) with **$0.06/M cached reads** and a **1M context window** makes the "stuff the whole knowledge base / user history into context" pattern affordable — pairs naturally with **Moss retrieval** (Moss finds the 10 right chunks <10ms; M3 reasons over them). Strong for **Support** and **Co-Pilot**.
- **On-the-fly audio/video/music** as a closing flourish — generate a custom jingle, a personalized video, or a sound-effect on stage.

## Hello world (talk in 30 seconds)

LLM (Anthropic-compatible, recommended):
```bash
export ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
export ANTHROPIC_API_KEY=${YOUR_API_KEY}
pip install anthropic
```
```python
import anthropic
client = anthropic.Anthropic()  # picks up env vars
msg = client.messages.create(
    model="MiniMax-M3", max_tokens=1000,
    system="You are a helpful assistant.",
    messages=[{"role": "user", "content": [{"type": "text", "text": "Hi, how are you?"}]}],
)
for block in msg.content:
    if block.type == "thinking": print("Thinking:", block.thinking)
    elif block.type == "text": print(block.text)
```

TTS hello-world (synchronous HTTP, one call → mp3):
```bash
curl --location 'https://api.minimax.io/v1/t2a_v2' \
  --header "Authorization: Bearer $MINIMAX_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "speech-2.8-hd",
    "text": "Hey there — I am your MiniMax voice agent.",
    "voice_setting": {"voice_id": "English_expressive_narrator", "speed": 1, "vol": 1, "pitch": 0},
    "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 1}
  }'
```

---

## Authentication, base URLs, hosts

- **Auth header (everything):** `Authorization: Bearer $MINIMAX_API_KEY`. Get a key at *API Keys → Create new secret key* (pay-as-you-go) or *Billing → Token Plan* (Subscription Key). Pay-as-you-go covers **all** modalities. **The key is shown only once — copy it.**
- **Global REST base:** `https://api.minimax.io` — e.g. `POST /v1/t2a_v2`, `POST /v1/voice_clone`, `POST /v1/music_generation`, `POST /v1/video_generation`, `POST /v1/files/upload`.
- **LLM Anthropic-compatible base:** `https://api.minimax.io/anthropic` (SDK) / `POST https://api.minimax.io/anthropic/v1/messages` (raw).
- **LLM OpenAI-compatible base:** `https://api.minimax.io/v1` / `POST /v1/chat/completions`.
- **TTS WebSocket:** `wss://api.minimax.io/ws/v1/t2a_v2`.
- **Low-latency TTS HTTP (reduced Time-To-First-Audio):** `https://api-uw.minimax.io/v1/t2a_v2` (alternative endpoint).

> There is also a `.chat` / China domain in some flows, but for this hackathon use **`api.minimax.io`** (`MINIMAX_API_HOST=https://api.minimax.io`).

---

## 1) Text-to-Speech (T2A) — the agent's voice

Three delivery modes. The model IDs and most params are shared across them.

### Models (TTS / clone / design all share these)
| Model | Notes |
| :-- | :-- |
| `speech-2.8-hd` | **Latest HD**. Ultra-realistic, sound tags, 40 languages, 7 emotions. |
| `speech-2.8-turbo` | **Latest Turbo**. Seamless speed + natural flow. Use this for **low-latency agents**. |
| `speech-2.6-hd` | Ultra-low latency, intelligent parsing, enhanced naturalness. |
| `speech-2.6-turbo` | Faster, more affordable, "ideal for your agent", 40 languages. |
| `speech-02-hd` | Superior rhythm/stability, best replication similarity (recommended for Voice Design). |
| `speech-02-turbo` | Superior rhythm/stability, enhanced multilingual. |

- **Languages:** 40 (Chinese, Cantonese, English, Spanish, French, Russian, German, Portuguese, Arabic, Italian, Japanese, Korean, Indonesian, Vietnamese, Turkish, Dutch, Ukrainian, Thai, Polish, Romanian, Greek, Czech, Finnish, Hindi, Bulgarian, Danish, Hebrew, Malay, Persian, Slovak, Swedish, Croatian, Filipino, Hungarian, Norwegian, Slovenian, Catalan, Nynorsk, Tamil, Afrikaans).
- **Emotions (7+):** `happy`, `sad`, `angry`, `fearful`, `disgusted`, `surprised`, `calm`, plus `fluent`, `whisper` (the latter two only on the 2.8/2.6 series). (`emotion` field; default `happy`.)
- **Output formats:** `mp3`, `pcm`, `flac`, `wav`. Streaming supported.
- **Limits:** sync (HTTP/WS) up to **10,000 chars/request**; async up to **1,000,000 chars/request**.

### Key request fields (from the MCP/T2A param spec)
`voice_setting`:
- `voice_id` (string) — system voice id, cloned, or designed voice. Default `female-shaonv`.
- `speed` — float `[0.5, 2.0]`, default `1.0`.
- `vol` — float `(0, 10]`, default `1.0`.
- `pitch` — int `[-12, 12]`, default `0`.
- `english_normalization` — bool (improves number/abbrev reading; default false).
- `emotion` — see emotions above.

`audio_setting`:
- `sample_rate` — `[8000, 16000, 22050, 24000, 32000, 44100]`, default `32000`.
- `bitrate` — `[32000, 64000, 128000, 256000]` (mp3 only), default `128000`.
- `format` — `["pcm","mp3","flac","wav"]`, default `mp3`.
- `channel` — `1` mono / `2` stereo, default `1`.

Top-level: `model`, `text`, `language_boost` (string, e.g. `"auto"` — biases recognition toward a language), `pronunciation_dict` (e.g. `{"tone": ["omg/oh my god"]}`), and `voice_modify` (`pitch`, `intensity`, `timbre`, `sound_effects` e.g. `"spacious_echo"`).

### 1a. Synchronous HTTP — `POST /v1/t2a_v2`
Stateless single call; returns audio. Use `https://api-uw.minimax.io/v1/t2a_v2` for lower TTFA. (See hello-world curl above.) **Rate limit: 60 RPM.**

### 1b. Streaming WebSocket — `wss://api.minimax.io/ws/v1/t2a_v2` (best for live agents)
Event protocol: connect → `task_start` → `task_continue` (send text) → receive audio chunks (hex-encoded in `data.audio`) until `is_final` → `task_finish`. Verbatim reference (streams + saves, plays via mpv):

```python
import asyncio, websockets, json, ssl, subprocess, os

model = "speech-2.8-hd"
file_format = "mp3"

class StreamAudioPlayer:
    def __init__(self):
        self.mpv_process = None
    def start_mpv(self):
        try:
            mpv_command = ["mpv", "--no-cache", "--no-terminal", "--", "fd://0"]
            self.mpv_process = subprocess.Popen(mpv_command, stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except FileNotFoundError:
            print("Error: mpv not found. Please install mpv"); return False
    def play_audio_chunk(self, hex_audio):
        try:
            if self.mpv_process and self.mpv_process.stdin:
                audio_bytes = bytes.fromhex(hex_audio)
                self.mpv_process.stdin.write(audio_bytes); self.mpv_process.stdin.flush()
                return True
        except Exception as e:
            print(f"Play failed: {e}"); return False
        return False
    def stop(self):
        if self.mpv_process:
            if self.mpv_process.stdin and not self.mpv_process.stdin.closed:
                self.mpv_process.stdin.close()
            try: self.mpv_process.wait(timeout=20)
            except subprocess.TimeoutExpired: self.mpv_process.terminate()

async def establish_connection(api_key):
    url = "wss://api.minimax.io/ws/v1/t2a_v2"
    headers = {"Authorization": f"Bearer {api_key}"}
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    ws = await websockets.connect(url, additional_headers=headers, ssl=ssl_context)
    connected = json.loads(await ws.recv())
    if connected.get("event") == "connected_success":
        return ws
    return None

async def start_task(websocket):
    start_msg = {
        "event": "task_start",
        "model": model,
        "voice_setting": {"voice_id": "English_expressive_narrator", "speed": 1, "vol": 1,
                          "pitch": 0, "english_normalization": False},
        "audio_setting": {"sample_rate": 32000, "bitrate": 128000, "format": file_format, "channel": 1}
    }
    await websocket.send(json.dumps(start_msg))
    response = json.loads(await websocket.recv())
    return response.get("event") == "task_started"

async def continue_task_with_stream_play(websocket, text, player):
    await websocket.send(json.dumps({"event": "task_continue", "text": text}))
    audio_data = b""
    while True:
        response = json.loads(await websocket.recv())
        if "data" in response and "audio" in response["data"]:
            audio = response["data"]["audio"]
            if audio and player.play_audio_chunk(audio):
                audio_data += bytes.fromhex(audio)
        if response.get("is_final"):
            with open(f"output.{file_format}", "wb") as f: f.write(audio_data)
            return 10

async def close_connection(ws):
    if ws:
        await ws.send(json.dumps({"event": "task_finish"})); await ws.close()
```
> `is_final` ends the stream; each chunk's `data.audio` is **hex** — `bytes.fromhex(...)` before playing/writing. Connect with `additional_headers` (newer `websockets`).

### 1c. Async long-form — `POST /v1/t2a_async_v2` (+ query) — up to 1M chars
Two-step: create task → poll status. Returns `task_id`; on success returns a `file_id` you download via the Files API. **Returned audio URL valid 9 hours (32,400s).** Returns subtitles (sentence-level timestamps), audio duration, file size. Query endpoint `GET /v1/query/t2a_async_query_v2?task_id=...` — **max 10 queries/sec**.

```python
# Create
url = "https://api.minimax.io/v1/t2a_async_v2"
payload = {
  "model": "speech-2.8-hd",
  "text": "A gentle breeze sweeps across the soft grass ... omg it's so beautiful.",  # or "text_file_id": <id>
  "language_boost": "auto",
  "voice_setting": {"voice_id": "English_expressive_narrator", "speed": 1, "vol": 10, "pitch": 1},
  "pronunciation_dict": {"tone": ["omg/oh my god"]},
  "audio_setting": {"audio_sample_rate": 32000, "bitrate": 128000, "format": "mp3", "channel": 2},
  "voice_modify": {"pitch": 0, "intensity": 0, "timbre": 0, "sound_effects": "spacious_echo"}
}
# Query:  GET https://api.minimax.io/v1/query/t2a_async_query_v2?task_id=${TASK_ID}
# Download: GET https://api.minimax.io/v1/files/retrieve_content?file_id=${FILE_ID}  -> write bytes
```
For file input: upload text first via `POST /v1/files/upload` with `purpose=t2a_async_input` (accepts a `.zip` of files), get `file_id`, pass as `text_file_id`.

### Concrete system `voice_id`s to copy-paste (English subset)
`English_expressive_narrator`, `English_radiant_girl`, `English_magnetic_voiced_man`, `English_Upbeat_Woman`, `English_Trustworth_Man`, `English_CalmWoman`, `English_Gentle-voiced_man`, `English_Graceful_Lady`, `English_FriendlyPerson`, `English_ConfidentWoman`, `English_PatientMan`, `English_Comedian`, `English_WiseScholar`, `English_CaptivatingStoryteller`, `English_AssertiveQueen`. (300+ total across 40 languages — also Chinese/Japanese/Cantonese/Korean families; enumerate live with the Get Voice API.)

---

## 2) Voice Cloning — the demo wow factor (`POST /v1/voice_clone`)

Clone a target timbre from a short sample and get a reusable `voice_id` in **one call**.

**Workflow:** (1) upload source audio → `file_id`; (2) optional: upload a <8s example/prompt audio → `file_id`; (3) call `/v1/voice_clone` with both + a chosen `voice_id`; (4) synthesize with that `voice_id` via any T2A API.

**Source audio requirements:** mp3 / m4a / wav, **10s–5min**, **≤20 MB**. **Prompt/example audio:** mp3/m4a/wav, **<8s**, ≤20 MB (boosts similarity + stability).

**`voice_id` rules:** length `[8,256]`, must start with a letter, only digits/letters/`-`/`_`, must not end with `-`/`_`, must be unique.

```python
import requests, os
api_key = os.getenv("MINIMAX_API_KEY")
upload_url = "https://api.minimax.io/v1/files/upload"
clone_url  = "https://api.minimax.io/v1/voice_clone"
headers = {"Authorization": f"Bearer {api_key}"}

# 1. upload source audio (purpose=voice_clone)
with open("/path/to/clone_input.mp3", "rb") as f:
    r = requests.post(upload_url, headers=headers,
                      data={"purpose": "voice_clone"},
                      files={"file": ("clone_input.mp3", f)})
    file_id = r.json()["file"]["file_id"]

# 2. (optional) upload <8s prompt audio (purpose=prompt_audio)
with open("/path/to/clone_prompt.mp3", "rb") as f:
    r = requests.post(upload_url, headers=headers,
                      data={"purpose": "prompt_audio"},
                      files={"file": ("clone_prompt.mp3", f)})
    prompt_file_id = r.json()["file"]["file_id"]

# 3. clone -> returns preview audio synthesized in the cloned voice
clone_payload = {
    "file_id": file_id,
    "voice_id": "MyFounderVoice01",          # your custom id (rules above)
    "clone_prompt": {"prompt_audio": prompt_file_id,
                     "prompt_text": "This voice sounds natural and pleasant."},
    "text": "These three nighttime habits will transform your life ...",  # preview text
    "model": "speech-2.8-hd"
}
r = requests.post(clone_url, headers={**headers, "Content-Type": "application/json"}, json=clone_payload)
print(r.text)
```

**Billing/lifecycle gotchas (memorize these):**
- Cloning **does not** charge at clone time. The **$1.5/voice** fee is billed the **first time you synthesize** with that voice.
- Cloned voices are **temporary**: you must use the `voice_id` in *any* T2A synth call **within 168h (7 days)** or it's deleted.
- Cloned voices start **inactive** and won't appear in `Get Voice` until used at least once.
- **Rate limit: Voice Cloning 60 RPM.** Voice-clone language support is broad (same family as TTS).

---

## 3) Voice Design — invent a voice from a text description (`POST /v1/voice_design`)

Describe the voice in words (e.g. "warm, gravelly late-night radio host, mid-40s") + a `preview_text`; get a custom `voice_id` usable in T2A. Recommended model `speech-02-hd`. Same temporary/7-day rule; **$3/voice**, billed on first use. Rate limit **20 RPM**. MCP params: `prompt` (required), `preview_text` (required), `voice_id` (optional, auto-generated), `output_directory`.

**Voice management:** `POST /v1/get_voice` lists all `voice_id`s under the account by category (`system`, `voice_cloning`, `voice_generation`, `music_generation`, `all`). `POST /v1/delete_voice` deletes a clone/design voice (irreversible; cannot reuse the id).

---

## 4) LLM — MiniMax-M3 + M2.x (Anthropic- & OpenAI-compatible)

### Models, context, RPM/TPM
| Model | Context | Speed / note | RPM | TPM |
| :-- | :-- | :-- | :-- | :-- |
| **MiniMax-M3** | **1,000,000** | Frontier agentic/coding, **multimodal** (image+video), thinking on by default | 200 | 10,000,000 |
| MiniMax-M2.7 / -highspeed | 204,800 | ~60 / ~100 tps | 500 | 20,000,000 |
| MiniMax-M2.5 / -highspeed | 204,800 | ~60 / ~100 tps | 500 | 20,000,000 |
| MiniMax-M2.1 / -highspeed | 204,800 | ~60 / ~100 tps | 500 | 20,000,000 |
| MiniMax-M2 | 204,800 | agentic, advanced reasoning | 500 | 20,000,000 |

> Max token count = input + output combined. M3 supports text/image/video/tool-use/tool-result/thinking; M2.x are **text + tool-call only** (no image/video).

### Anthropic-compatible (recommended path)
```bash
pip install anthropic   # or: npm install @anthropic-ai/sdk
export ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
export ANTHROPIC_API_KEY=${YOUR_API_KEY}
```
```python
client = anthropic.Anthropic(base_url="https://api.minimax.io/anthropic", api_key="<KEY>")
message = client.messages.create(model="MiniMax-M3", max_tokens=1000,
    messages=[{"role":"user","content":"Hi, how are you?"}])
```
Raw: `POST https://api.minimax.io/anthropic/v1/messages`. Token-count helper: `POST /anthropic/v1/messages/count_tokens` (M3; returns input usage without generating).

**Supported Anthropic params:** `model`, `messages`, `max_tokens`, `stream`, `system`, `temperature` `[0,2]` (rec. 1), `tool_choice`, `tools`, `top_p` `[0,1]` (default 0.95 M3 / 0.9 M2.x), `metadata`, `thinking`. **Ignored:** `top_k`, `stop_sequences`, `mcp_servers`, `context_management`, `container`.

**Thinking control (M3):** omitted = on; `thinking:{"type":"adaptive"}` = on; `thinking:{"type":"disabled"}` = off. M2.x cannot disable thinking. **In multi-turn / tool-use, append the full `response.content` (thinking + text + tool_use blocks) back into history unchanged** — required to keep the reasoning chain.

**M3 multimodal inputs:** `type:"image"` (URL/base64; JPEG/PNG/GIF/WEBP, ≤10MB) and `type:"video"` (URL/base64/`mm_file://{file_id}`; MP4/AVI/MOV/MKV; URL/base64 ≤50MB, request body ≤64MB, Files-API videos ≤512MB). `detail` low/default/high controls image token cost.

### OpenAI-compatible (zero-migration)
```bash
export OPENAI_BASE_URL=https://api.minimax.io/v1
export OPENAI_API_KEY=${YOUR_API_KEY}
```
`POST /v1/chat/completions`, model `MiniMax-M3`. Multimodal via `image_url` / `video_url` content parts (`fps` default 1, range 0.2–5; `max_long_side_pixel`). Extra params via `extra_body`: `thinking`, `reasoning_split` (true → thinking split into `reasoning_content`/`reasoning_details`; false → `<think>...</think>` inside `content`), `max_completion_tokens`, `stream_options.include_usage`.

### Prompt caching (Anthropic-style, explicit `cache_control`)
Mark static prefixes (tools → system → messages order) with `{"cache_control":{"type":"ephemeral"}}`. **5-minute lifetime, refreshed free on each hit.** Up to **4 cache breakpoints** per call; **20-block lookback** window.
```python
response = client.messages.create(
    model="MiniMax-M2.7", max_tokens=1024,
    system=[
      {"type":"text","text":"You are an AI assistant analyzing literary works."},
      {"type":"text","text":"<the entire contents of 'Pride and Prejudice'>",
       "cache_control":{"type":"ephemeral"}}
    ],
    messages=[{"role":"user","content":"Analyze the major themes."}])
print(response.usage.model_dump_json())
# 1st: {"cache_creation_input_tokens":188086,"cache_read_input_tokens":0,...}
# 2nd: {"cache_creation_input_tokens":0,"cache_read_input_tokens":188086,...}
```
`usage` fields: `cache_creation_input_tokens` (writes), `cache_read_input_tokens` (reads), `input_tokens` (after last breakpoint). **For a voice agent: cache the system prompt + retrieved KB once, then only the changing user turn is full-price input.**

### LLM pricing ($/M tokens, pay-as-you-go)
| Model | Input | Output | Cache Read | Cache Write |
| :-- | :-- | :-- | :-- | :-- |
| **MiniMax-M3** ≤512k (7-day 50% off) | **$0.30** | **$1.20** | **$0.06** | — |
| MiniMax-M3 >512k input | $1.20 | $4.80 | $0.24 | — |
| MiniMax-M2.7 | $0.30 | $1.20 | $0.06 | $0.375 |
| MiniMax-M2.7-highspeed | $0.60 | $2.40 | $0.06 | $0.375 |
| M2.5 / M2.1 / M2 | $0.30 | $1.20 | $0.03 | $0.375 |
> ~750 English words ≈ 1000 tokens. "Priority" tier via `service_tier` (contact sales).

---

## 5) Music Generation — `POST /v1/music_generation` (model `music-2.6`)

Full vocal songs from a `prompt` (style/mood) + `lyrics`. Optional **Lyrics Generation** (`POST /v1/lyrics_generation`) and **Cover** (one-step or two-step). `lyrics` supports `[Intro] [Verse] [Chorus] [Bridge] [Outro]`, lines split by `\n`, 10–600 chars; `prompt` 10–300 chars. Set `lyrics_optimizer:true` to skip writing lyrics; `is_instrumental:true` for music only.
```python
payload = {
  "model": "music-2.6",
  "prompt": "Soulful Blues, Rainy Night, Melancholy, Male Vocals, Slow Tempo",
  "lyrics": "[Intro]\n(Ooh, yeah)\n[Verse 1]\nThe sky is cryin' ...\n[Chorus]\nMidnight rain, fallin' down on me",
  "audio_setting": {"sample_rate": 44100, "bitrate": 256000, "format": "mp3"},
  "output_format": "url"
}  # POST https://api.minimax.io/v1/music_generation
```
**Cover:** `model:"music-cover"` + `audio_url` (one-step, lyrics auto-extracted via ASR) OR `POST /v1/music_cover_preprocess` (free) → get `cover_feature_id` + `formatted_lyrics`, edit lyrics, then generate with `cover_feature_id` (don't pass `audio_url` with it). Price: **$0.15 / up-to-5min** (limited free); lyrics $0.01/song. **120 RPM.**

---

## 6) Video Generation — `POST /v1/video_generation` (Hailuo 2.3)

Async: create task → poll `GET /v1/query/video_generation?task_id=` → on `Success` get `file_id` → `GET /v1/files/retrieve?file_id=` → download `download_url`. Models: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast` (i2v value), `MiniMax-Hailuo-02` (legacy). Modes: text-to-video, image-to-video (`first_frame_image`), first-and-last-frame (`first_frame_image`+`last_frame_image`), subject-reference (`subject_reference` face photo, model `S2V-01`). `duration` 6/10, `resolution` `512P/768P/1080P` (1080P is 6s only).
```python
payload = {"prompt": "A tiktok dancer dancing on a drone, doing flips.",
           "model": "MiniMax-Hailuo-2.3", "duration": 6, "resolution": "1080P"}
# returns {"task_id": ...}; poll status; status=="Success" -> file_id
```
Price: Hailuo-2.3-Fast $0.19 (768P/6s) → $0.33 (1080P/6s); Hailuo-2.3 $0.28 → $0.49. **5 RPM** — generation takes tens of seconds; pre-generate demo assets. There's also a **Video Agent** (template-based: `POST /v1/.../video-agent-create`) with prebuilt templates (Diving, Run for Life, Transformers, etc.).

## 7) Image Generation — `POST /v1/image_generation` (`image-01`)
Text-to-image and image-to-image (subject reference for people). `aspect_ratio` 1:1/16:9/9:16/etc., `n` 1–9, `prompt_optimizer`. **$0.0035/image. 10 RPM.**

## 8) Files API
`POST /v1/files/upload` (multipart; `purpose` ∈ `voice_clone`, `prompt_audio`, `t2a_async_input`, ...) → `{"file":{"file_id":...}}`. `GET /v1/files/retrieve?file_id=` (metadata/`download_url`), `GET /v1/files/retrieve_content?file_id=` (raw bytes), plus list/delete. Docs: pdf/docx/txt/jsonl; audio: mp3/m4a/wav. **100GB total / 512MB per file.**

## 9) Official MCP servers
Python `uvx minimax-mcp` (and JS `MiniMax-MCP-JS`). Tools: `text_to_audio`, `list_voices`, `voice_clone`, `voice_design`, `play_audio`, `music_generation`, `generate_video`, `image_to_video` (JS only), `query_video_generation`, `text_to_image`. Config:
```json
{"mcpServers":{"MiniMax":{"command":"uvx","args":["minimax-mcp"],
  "env":{"MINIMAX_API_KEY":"<key>","MINIMAX_MCP_BASE_PATH":"/Users/you/Desktop",
         "MINIMAX_API_HOST":"https://api.minimax.io","MINIMAX_API_RESOURCE_MODE":"url"}}}}
```

---

## Hackathon recipes (compose with Moss / LiveKit / Unsiloed / TrueFoundry / AWS)

1. **MiniMax TTS as the LiveKit voice (all tracks).** In a LiveKit Agents pipeline (STT → LLM → TTS), wire MiniMax as the TTS provider. LiveKit streams agent text → your MiniMax WebSocket client (`wss://api.minimax.io/ws/v1/t2a_v2`, `speech-2.8-turbo`) → push the hex-decoded PCM/MP3 chunks into the LiveKit audio track as they arrive (don't wait for `is_final`). Use the `api-uw.minimax.io` HTTP endpoint as a fallback for one-shot lines. **Demo line:** "every voice in this room is a different MiniMax voice_id, switched live."

2. **Cloned-voice callbacks (Lead Gen, 1st-prize bait).** At booth check-in, record the AE/founder 30s → `purpose=voice_clone` upload → `/v1/voice_clone` → `voice_id`. The LiveKit agent then qualifies a lead and "calls back" speaking in the rep's own cloned voice. Pair with **Moss** to retrieve the lead's CRM history (<10ms) and **M3** to draft the pitch. Remember to synth once immediately so the clone persists past 7 days.

3. **RAG support bot: Unsiloed → Moss → M3 → MiniMax TTS (Support).** **Unsiloed** parses the support PDFs/manuals; chunks go into **Moss** for sub-10ms semantic retrieval; the agent stuffs the top chunks + user history into **MiniMax-M3** (1M context, `cache_control` on the system prompt + docs so repeat turns cost $0.06/M) and answers via streaming TTS. Cost story: "$0.30/M in, $0.06/M cached — we can read the whole manual every turn for cents."

4. **Ambient co-pilot that surfaces + speaks live context (Co-Pilot).** LiveKit captures the meeting audio; M3 (or M2.x) listens, Moss retrieves the relevant doc/snippet in real time, and MiniMax TTS whispers (`emotion:"whisper"`, low `vol`) the surfaced fact into one earpiece. Use `english_normalization:true` so figures/IDs read cleanly.

5. **On-stage generative flourish.** Live: generate a 15-second custom **jingle** (`music_generation`) with the judges' names in the lyrics, or a personalized **Hailuo video**. Pre-warm video (5 RPM, ~tens of seconds) before the pitch; trigger music live (faster).

6. **TrueFoundry gateway + AWS hosting.** Route MiniMax's OpenAI-compatible endpoint (`https://api.minimax.io/v1`) through **TrueFoundry's LLM gateway** for keys/quotas/observability across M3 + other providers; host the LiveKit agent worker + your FastAPI glue on **AWS**. Keep `MINIMAX_API_KEY` server-side; never ship it to the browser.

---

## Gotchas / latency notes / what to demo

- **Stream TTS, never block.** For perceived latency, use the **WebSocket** path and play each chunk on arrival; HTTP `t2a_v2` returns the whole clip. Use `api-uw.minimax.io` for lower HTTP TTFA, and prefer **`speech-2.8-turbo`/`speech-2.6-turbo`** for agents.
- **Audio chunks are hex.** WS `data.audio` must go through `bytes.fromhex()` before playback/write.
- **Cloned/Designed voices are temporary (7 days)** and **inactive until first use** — synth once right after creating, or they vanish and won't list. Cloning is billed on **first synth**, not at clone time.
- **Clone audio constraints:** source 10s–5min ≤20MB; prompt audio **<8s** (error 2048 if too long). `voice_id` must start with a letter, ≥8 chars, no trailing `-`/`_` (error 2039 on dup).
- **Rate limits are tight for a hackathon:** Video **5 RPM**, Image **10 RPM**, Voice Design **20 RPM**, T2A/Voice-Clone **60 RPM**, Music **120 RPM**. Pre-generate heavy assets; don't spam during the live demo.
- **M3 thinking is on by default** and emits `thinking` blocks — strip them from spoken output, but **re-append them to history** in tool-use loops or you break the chain. For latency-sensitive small replies, `thinking:{"type":"disabled"}` (M3 only).
- **Two key types:** pay-as-you-go API Key (all modalities) vs Token Plan Subscription Key — don't mix; use the API Key for the booth build.
- **Async URLs expire:** long-TTS download URL valid **9h**; cover `cover_feature_id` valid **24h**. Download promptly.
- **Errors to expect:** `1002` rate limit / `1008` insufficient balance / `2049` invalid API Key / `1004` not authorized / `1042` invisible-char ratio / `1043` clone ASR similarity fail / `2037` clone audio too short/long / `2048` prompt audio >8s.
- **What scores:** live voice clone (record→speak in <60s), an agent that **switches emotion/voice mid-conversation**, and the cost slide (M3 $0.06/M cached reads + Moss retrieval). These are cheap to build and read as "fundable."

---

## Cheat-sheet — the 10 things you'll copy-paste at 2am

1. **Auth (all):** `-H "Authorization: Bearer $MINIMAX_API_KEY"` · REST base `https://api.minimax.io`.
2. **LLM env (Anthropic):** `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`, model `MiniMax-M3` (1M ctx). OpenAI: `OPENAI_BASE_URL=https://api.minimax.io/v1`.
3. **TTS HTTP:** `POST /v1/t2a_v2` (low-latency host `https://api-uw.minimax.io/v1/t2a_v2`), model `speech-2.8-turbo`, `voice_setting.voice_id`, `audio_setting.format`.
4. **TTS streaming:** `wss://api.minimax.io/ws/v1/t2a_v2` → `task_start` → `task_continue` → hex `data.audio` until `is_final` → `task_finish`.
5. **Clone in 3 calls:** upload `purpose=voice_clone` → (opt) `purpose=prompt_audio` (<8s) → `POST /v1/voice_clone` `{file_id, voice_id, model:"speech-2.8-hd"}`. Synth once within 7 days to keep it.
6. **Voice from text:** `POST /v1/voice_design` `{prompt, preview_text}` → `voice_id`. List/delete: `POST /v1/get_voice` / `/v1/delete_voice`.
7. **Prompt caching:** put static content first, add `"cache_control":{"type":"ephemeral"}` (≤4 breakpoints, 5-min TTL) → cache reads $0.06/M.
8. **English voices:** `English_expressive_narrator`, `English_Trustworth_Man`, `English_CalmWoman`, `English_ConfidentWoman`, `English_Comedian`. Emotions: `happy/sad/angry/calm/whisper`.
9. **Music:** `POST /v1/music_generation` `{model:"music-2.6", prompt, lyrics:"[Verse]...\n[Chorus]...", output_format:"url"}`. **Video:** `POST /v1/video_generation` → poll `/v1/query/video_generation` → `/v1/files/retrieve`.
10. **Files:** upload `POST /v1/files/upload` (multipart, `purpose=...`) → `file.file_id`; download `GET /v1/files/retrieve_content?file_id=`. Limits: 60 RPM TTS, 5 RPM video.

---

## Appendix — Coverage Completion (audit-driven, added 2026-06-05)

> These sections fill in-scope gaps the coverage audit flagged against the local docs dump. All values are quoted verbatim from `raw/mm-llms-full.txt`. Source doc URLs are given per subsection.

### A1. OpenAI **Responses API** — `POST /v1/responses` (+ `/v1/responses/input_tokens`) _(Medium)_

A third LLM-compat surface alongside Chat Completions and Anthropic Messages. Calls MiniMax models via the **OpenAI Responses API**-compatible endpoint; supports streaming and non-streaming. Source: `/docs/api-reference/responses-create`, `/docs/api-reference/responses-input-tokens`.

- **Endpoint:** `POST https://api.minimax.io/v1/responses`
- **`input` shorthand:** pass the prompt as a plain `input` string (no `messages` array needed).
- **Reasoning control (M3):** the `reasoning` field controls reasoning output. Omitted → reasoning on by default (response includes an output item with `type:"reasoning"`). Set `reasoning:{"effort":"none"}` to **disable** reasoning output for `MiniMax-M3`. Values `minimal`/`low`/`medium`/`high` are **accepted for compatibility but keep reasoning enabled and do not tune M3's reasoning depth**. For M2.x, reasoning cannot be disabled (`{"effort":"none"}` is accepted but reasoning stays on).
- **Pre-flight token estimate:** `POST https://api.minimax.io/v1/responses/input_tokens` — estimates the input token count of a request **without invoking the model** (evaluate cost / check context-length limits before the main call).

```json
{ "model": "MiniMax-M3", "input": "Which is larger, 9.11 or 9.9?" }
```
```json
{ "model": "MiniMax-M3", "input": "Which is larger, 9.11 or 9.9?", "reasoning": { "effort": "none" } }
```

**Why it matters for the hackathon:** if your stack is already on the OpenAI Responses API, MiniMax is a drop-in `base_url` swap — and `reasoning:{"effort":"none"}` is the latency lever for short, snappy voice-agent replies (the Responses-API analog of `thinking:{"type":"disabled"}`).

### A2. **M-series prompting best practices** — incl. the TTS-formatting pattern _(Medium)_

Prompt patterns for coding, tool-use, agentic, and long-context workflows. Source: `/docs/token-plan/prompting-best-practices`.

- **The voice-agent formatting tip (verbatim, "Add context to improve performance"):**

  > Your response will be read aloud by a text-to-speech model. Use plain text only, avoid document symbols, and keep sentences short enough to sound natural when spoken.

  (The doc's point: don't just say "Do not use document symbols" — state the *intent* so the model makes better tradeoffs. Put this line in your agent's system prompt so the LLM never emits markdown/bullets/headers that the TTS engine would read aloud literally.)
- **Be clear and direct:** state task, constraints, and desired output explicitly. *"Golden rule: show your prompt to a colleague with no context — if they'd be confused, the model will be too."*
- **Few-shot beats abstract style:** for classification / structured extraction / edge cases, give **3–5 diverse examples** (relevant, diverse incl. one ambiguous input, concrete) rather than one.
- **Structure with labeled sections:** use short labels — `Task`, `Context`, `Source`, `Constraints`, `Output format` — with a bold header or trailing colon; keep structure flat (deep nesting hurts).
- **Long context:** *"Of all long-context techniques, placing the task **at the end** of the prompt (after the source) has the largest single impact on answer quality."* Delimit and index source material; for very large inputs ask the model to quote/summarize relevant parts before answering.
- **Match output language** explicitly when input mixes languages (otherwise the model follows the dominant input language).
- Note: Token Plan models are **language-only** — handle images/audio/video with another tool before passing context.

**Why it matters for the hackathon:** the "read aloud by TTS → plain text, short sentences" line is the single highest-leverage system-prompt addition for any MiniMax voice agent; "task at the end" maximizes answer quality when you stuff a 1M-context KB in front of M3.

### A3. **Model-discovery endpoints** (OpenAI + Anthropic compatible) _(Low)_

Enumerate available model IDs at runtime. Source: `/docs/api-reference/models/*`.

- `GET https://api.minimax.io/v1/models` — list all models (OpenAI spec).
- `GET https://api.minimax.io/v1/models/{model_id}` — retrieve one model (OpenAI spec).
- `GET https://api.minimax.io/anthropic/v1/models` — list all models (Anthropic spec).
- `GET https://api.minimax.io/anthropic/v1/models/{model_id}` — retrieve one model (Anthropic spec).

```bash
curl https://api.minimax.io/v1/models -H "Authorization: Bearer $MINIMAX_API_KEY"
```

**Why it matters for the hackathon:** lets a model-picker UI or a TrueFoundry-gateway config discover live model IDs (e.g. confirm `MiniMax-M3` vs the M2.x variants) instead of hard-coding them.

### A4. **Vercel AI SDK provider** — `vercel-minimax-ai-provider` (M2.x only) _(Low)_

Official community provider for the [AI SDK](https://ai-sdk.dev) ecosystem. Source: `/docs/api-reference/text-ai-sdk`.

```bash
npm install ai vercel-minimax-ai-provider
export MINIMAX_API_KEY=${YOUR_API_KEY}
```
```typescript
import { minimax } from 'vercel-minimax-ai-provider';      // Anthropic-format (default)
import { generateText } from 'ai';
const { text, reasoning } = await generateText({
  model: minimax('MiniMax-M2.7'),
  system: 'You are a helpful assistant.',
  prompt: 'Hi, how are you?',
});
```
- **Two instances:** default `minimax` uses the **Anthropic-compatible** format; use **`minimaxOpenAI`** for the OpenAI-compatible format.
- **Constraint — M2.x only, NOT M3:** supports `MiniMax-M2.7`, `-M2.7-highspeed`, `MiniMax-M2.5`, `-M2.5-highspeed`, `MiniMax-M2.1`, `-M2.1-highspeed`, `MiniMax-M2` (all 204,800 ctx). For M3 or any other model, use the standard MiniMax API directly.
- **No image/file input** (`type:"image"` and `type:"file"` not supported); text + tool-call only. `temperature` `[0,2]` (out-of-range errors); `topP` default 0.9 for M2.x.
- Multi-turn tool use: append the full `result.response.messages` (all assistant + tool messages) to history to preserve the reasoning chain.

**Why it matters for the hackathon:** if the agent's brain is a Next.js / AI-SDK app, this is the fastest wire-up — but budget for the **M3 gap**: keep your multimodal/1M-context calls on the raw Anthropic/OpenAI path, route only M2.x text/tool turns through the AI SDK.

### A5. **Local / self-host deployment** of MiniMax-M2.7 (vLLM / SGLang / MLX) _(Low-medium)_

For a private/offline LLM brain. Source: `/docs/guides/local-deploy`. All three expose an **OpenAI-compatible** API at `http://localhost:8000/v1` (so the same client code as the hosted API).

- **System reqs (GPU path):** Linux, Python 3.10–3.12, GPU compute capability ≥7.0. Max context **196K tokens per sequence**. KV-cache capacity: 96 GB×4 → up to 400K tokens; 144 GB×8 → up to 3M tokens.
- **vLLM (4-GPU):**
  ```bash
  SAFETENSORS_FAST_GPU=1 vllm serve \
      MiniMaxAI/MiniMax-M2.7 --trust-remote-code \
      --tensor-parallel-size 4 \
      --enable-auto-tool-choice --tool-call-parser minimax_m2 \
      --reasoning-parser minimax_m2_append_think
  ```
- **SGLang (4-GPU):**
  ```bash
  python -m sglang.launch_server \
      --model-path MiniMaxAI/MiniMax-M2.7 --tp-size 4 \
      --tool-call-parser minimax-m2 --reasoning-parser minimax-append-think \
      --host 0.0.0.0 --trust-remote-code --port 8000 --mem-fraction-static 0.85
  ```
- **MLX (Apple Silicon Mac Studio):** third supported framework for local inference.
- **Verify:** `curl http://localhost:8000/v1/chat/completions` with model `MiniMaxAI/MiniMax-M2.7` (OpenAI-compatible body), `api_key="not-needed"`.

**Why it matters for the hackathon:** a "your data never leaves the box" privacy demo for the Support/Co-Pilot tracks — run M2.7 on a rented GPU box (or a Mac Studio at the booth) and keep the LiveKit/MiniMax-TTS pipeline pointed at `localhost`.

### A6. **OpenAI multimodal image-token-cost heuristic** (`detail`) _(Low)_

When sending images to M3, the `detail` field drives token cost. Source: `/docs/api-reference/text-post` (multimodal section). Rough single-image heuristic (check `usage` / `count_tokens` for exact):

| `detail`  | Rough single-image token usage |
| :-- | :-- |
| `low` | Usually a few hundred tokens, up to ~600 |
| `default` | Often ~1k–3k tokens, up to ~5k |
| `high` | Often several thousand tokens, up to ~15k+ |

`detail` accepts `low`/`default`/`high` (defaults to `default`); `max_long_side_pixel` controls the longest side. For exact counts use `POST /anthropic/v1/messages/count_tokens` (M3).

**Why it matters for the hackathon:** if a vision-enabled agent screenshots the screen each turn (Co-Pilot), pin `detail:"low"` to keep per-frame cost near ~600 tokens instead of blowing past 15k on `high`.

### A7. **Video Agent template query** + template catalog pointer _(Low)_

Completes the template-based video path. Source: `/docs/api-reference/video-agent-create`, `/docs/api-reference/video-agent-query`, `/docs/faq/video-agent-templates`.

- **Create:** `POST https://api.minimax.io/v1/video_template_generation`
- **Query status:** `GET https://api.minimax.io/v1/query/video_template_generation`
- Full template-ID catalog lives in the **Video Agent Template List** FAQ (`/docs/faq/video-agent-templates`); the report already names sample templates (Diving, Run for Life, Transformers).

**Why it matters for the hackathon:** the template path is the fastest way to a polished on-stage video flourish — fire `video_template_generation`, then poll `query/video_template_generation` (distinct from the plain `query/video_generation` used for t2v/i2v).

### A8. **Music API concurrency cap** _(Trivial)_

In addition to **120 RPM**, the Music API (`Music-2.6` / `Music-Cover` / `Music-2.0`) has a **CONN = 20** concurrent-connection cap. Source: Rate Limits → Music table.

**Why it matters for the hackathon:** if you fan out several jingle/cover generations at once on stage, keep concurrent music requests ≤20 or they'll be rejected even under the RPM limit.
