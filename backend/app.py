"""Haq Assist API (localhost only).

Run:  .venv\\Scripts\\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
Needs: llama-server (Gemma 4 12B) on :8091 and, for voice, VoiceStudio on :3900 - both on GPU 1.
"""
from __future__ import annotations

import os

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "GPU-dcd92a54-ad5d-60fe-692f-264c71b64b3c")  # GPU 1 (no display)
os.environ.setdefault("HF_HOME", os.path.join(os.path.dirname(__file__), "..", "models", "hf"))

import json
import queue
import threading
from pathlib import Path

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from .app_state import engine

ROOT = Path(__file__).resolve().parents[1]
VOICE = os.environ.get("HAQ_VOICE_URL", "http://127.0.0.1:3900")
STREAM_SLOTS = threading.BoundedSemaphore(2)  # concurrent /api/ask/stream requests
app = FastAPI(title="Haq Assist", version="0.2")


@app.middleware("http")
async def always_fresh_frontend(request, call_next):
    """Browsers must re-check the web app's files on every load (a cheap 304 when unchanged). Without this, a
    browser that cached the old stylesheet (Brave did) shows the new page with old styles and looks broken."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    region: str | None = Field(default=None, description="ict | punjab | sindh | kp | balochistan; null = let the app infer or ask")
    online: bool = Field(default=False, description="Allow the official-websites fallback (sends a rewritten query to external search providers). Default False = local library only.")


@app.post("/api/ask")
def ask(body: AskIn) -> dict:
    q = body.question.strip()
    if len(q) < 2:
        raise HTTPException(422, "empty question")
    if body.region and body.region not in ("ict", "punjab", "sindh", "kp", "balochistan"):
        raise HTTPException(422, "unknown region")
    try:
        return engine().ask(q, body.region, body.online)
    except httpx.HTTPError:
        raise HTTPException(503, "the local AI model is not reachable")
    except (ValueError, KeyError):
        raise HTTPException(502, "the AI model returned an unexpected answer; please try again")


@app.post("/api/ask/stream")
def ask_stream(body: AskIn) -> StreamingResponse:
    """The same answer as /api/ask, plus the engine's real progress events as they happen (one JSON object per
    line): understanding, each search angle and the law it lands in, drafting, and every quote check. The last line
    is {"type": "result", "data": ...} or {"type": "error", "detail": ...}."""
    q = body.question.strip()
    if len(q) < 2:
        raise HTTPException(422, "empty question")
    if body.region and body.region not in ("ict", "punjab", "sindh", "kp", "balochistan"):
        raise HTTPException(422, "unknown region")
    # The local model answers one question at a time; a small cap keeps waiting streams from tying up the server.
    if not STREAM_SLOTS.acquire(blocking=False):
        raise HTTPException(429, "Haq is answering other questions right now; please try again in a moment")
    events: queue.Queue = queue.Queue()

    def put(ev: dict) -> None:
        try:  # serialise here, inside the guard, so a bad event can't break the stream after headers are sent
            events.put(json.dumps(ev, ensure_ascii=False) + "\n")
        except (TypeError, ValueError):
            events.put(json.dumps({"type": "note", "detail": "a progress event could not be shown"}) + "\n")

    def work() -> None:
        try:
            put({"type": "result", "data": engine().ask(q, body.region, body.online, emit=put)})
        except httpx.HTTPError:
            put({"type": "error", "detail": "the local AI model is not reachable"})
        except (ValueError, KeyError):
            put({"type": "error", "detail": "the AI model returned an unexpected answer; please try again"})
        except Exception:  # never leak internals into the stream
            put({"type": "error", "detail": "something went wrong while answering; please try again"})
        finally:
            STREAM_SLOTS.release()
            events.put(None)

    threading.Thread(target=work, daemon=True).start()

    def lines():
        while (line := events.get(timeout=300)) is not None:
            yield line

    return StreamingResponse(lines(), media_type="application/x-ndjson", headers={"Cache-Control": "no-store"})


@app.get("/api/health")
def health() -> dict:
    search = json.loads((ROOT / "backend" / "config.json").read_text())
    search.pop("abstain_threshold", None)  # experiment-time value; the live engine abstains when the checks fail
    search["abstain"] = "when the retrieved law does not answer, or no claim passes the verification checks"
    out = {"library_sections": len(engine().sections), "search": search}
    for name, url in (("llm", "http://127.0.0.1:8091/health"), ("voice", f"{VOICE}/health")):
        try:
            out[name] = httpx.get(url, timeout=3).json().get("status")
        except Exception:
            out[name] = "down"
    # Urdu voice replies need OmniVoice, whose non-commercial licence must be accepted in VoiceStudio first
    try:
        acc = httpx.get(f"{VOICE}/models/licenses/acceptance/k2-fsa/OmniVoice", timeout=3).json()
        out["voice_reply"] = bool(acc.get("accepted")) and out.get("voice") == "ok"
    except Exception:
        out["voice_reply"] = False
    return out


MAX_AUDIO = 10_000_000


@app.post("/api/voice/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict:
    """Urdu / Roman-Urdu / English speech -> text, via VoiceStudio (local Whisper). Audio is not stored."""
    if not (audio.content_type or "").startswith("audio/"):
        raise HTTPException(415, "audio only")
    data = await audio.read(MAX_AUDIO + 1)
    if len(data) > MAX_AUDIO:
        raise HTTPException(413, "recording too long")
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(f"{VOICE}/v1/audio/transcriptions",
                             files={"file": (audio.filename or "audio.webm", data, audio.content_type)},
                             data={"model": "whisper-1", "response_format": "json"})  # Whisper detects Urdu/English itself
        r.raise_for_status()
        return {"text": str(r.json().get("text", ""))[:2000]}
    except Exception:
        raise HTTPException(502, "voice service unavailable")


@app.get("/api/library")
def library() -> dict:
    """What is in the statute library, grouped into plain-language areas of law (for the home page)."""
    from .engine import law_area
    eng = engine()
    areas: dict[str, dict] = {}
    for s in eng.sections.values():
        a = areas.setdefault(law_area(s["act_id"]), {"sections": 0, "acts": set()})
        a["sections"] += 1
        a["acts"].add(s["act_id"])
    return {"sections": len(eng.sections), "acts": len({s["act_id"] for s in eng.sections.values()}),
            "areas": sorted(({"area": k, "sections": v["sections"], "acts": len(v["acts"])} for k, v in areas.items()),
                            key=lambda a: -a["sections"])}


@app.get("/api/cards")
def cards() -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted((ROOT / "data" / "cards").glob("*.json"))]


@app.get("/api/lawyers")
def lawyers(city: str | None = None, area: str | None = None) -> list[dict]:
    rows = json.loads((ROOT / "data" / "lawyers.json").read_text(encoding="utf-8"))
    if city:
        rows = [r for r in rows if r["city"].lower() == city.lower()]
    if area:
        rows = [r for r in rows if any(area.lower() in a.lower() for a in r["practice_areas"])]
    return rows


class StoryIn(BaseModel):
    story: str = Field(min_length=5, max_length=3000)


@app.post("/api/complaint/extract")
def complaint_extract(body: StoryIn) -> dict:
    from . import complaint
    try:
        out = complaint.extract(body.story.strip())
    except Exception:
        raise HTTPException(502, "could not read the story; please try again")
    return {k: str(out.get(k, ""))[:1000] for k in complaint.FIELDS}


class DraftIn(BaseModel):
    fields: dict[str, str] = Field(default_factory=dict)
    region: str = Field(default="ict", pattern="^(ict|punjab)$")


@app.post("/api/complaint/draft")
def complaint_draft(body: DraftIn) -> dict:
    from . import complaint
    fields = {k: v[:1000] for k, v in body.fields.items() if k in complaint.FIELDS}
    return complaint.draft(fields, body.region, engine().sections)


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: str = "ur"


@app.post("/api/voice/speak")
def speak(body: SpeakIn) -> Response:
    """Text -> Urdu speech via VoiceStudio (OmniVoice)."""
    try:
        r = httpx.post(f"{VOICE}/v1/audio/speech", timeout=300,
                       json={"model": "omnivoice", "input": body.text, "language": body.language, "response_format": "mp3"})
        r.raise_for_status()
        return Response(r.content, media_type=r.headers.get("content-type", "audio/mpeg"))
    except Exception:
        raise HTTPException(502, "voice service unavailable")


# The web app (static files) - mounted last so /api routes take priority.
from fastapi.staticfiles import StaticFiles  # noqa: E402

app.mount("/", StaticFiles(directory=ROOT / "frontend", html=True), name="frontend")
