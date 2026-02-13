"""
FastAPI backend for Live Avatar Lip Sync.

Endpoints:
  - WebSocket /ws/audio     : Real-time audio stream → viseme events
  - POST /api/process-audio : Upload audio file (MP3/WAV) → viseme timeline
  - POST /api/process-text  : Text → viseme sequence
  - GET  /api/visemes       : List all 12 viseme definitions
  - GET  /api/health        : Health check
"""

import io
import json
import wave
from typing import Literal, Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from audio_processor import AudioProcessor
from text_processor import TextProcessor
from viseme_mapper import SyncEngine, VISEME_LABELS, VISEME_COUNT

app = FastAPI(title="LipSync Backend", version="1.0.0")

# CORS for Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---

class TextRequest(BaseModel):
    text: str
    speed: float = 1.0

VALID_MODES = Literal["hybrid", "audio_only", "text_only"]

class ProcessAudioRequest(BaseModel):
    mode: VALID_MODES = "hybrid"
    text: Optional[str] = None


# --- REST Endpoints ---

@app.get("/api/health")
async def health():
    return {"status": "ok", "viseme_count": VISEME_COUNT}


@app.get("/api/visemes")
async def list_visemes():
    """Return all 12 viseme definitions."""
    visemes = []
    descriptions = [
        "Rest/silence — mouth closed",
        "Wide open — father, cat",
        "Tongue on ridge — d, t, n",
        "Wide smile — see, bit",
        "Lower lip under teeth — f, v",
        "Tongue tip up — l",
        "Lips pressed — m, b, p",
        "Rounded open — boat, saw",
        "Slight pucker — r",
        "Teeth narrow — s, z, sh, ch",
        "Slightly open — uh, schwa",
        "Pursed/rounded — w, oo, blue",
    ]
    for i in range(VISEME_COUNT):
        visemes.append({
            "index": i,
            "label": VISEME_LABELS[i],
            "description": descriptions[i],
        })
    return {"visemes": visemes}


@app.post("/api/process-text")
async def process_text(request: TextRequest):
    """Convert text to viseme sequence with durations."""
    processor = TextProcessor()
    processor.set_speed(request.speed)
    events = processor.process_text(request.text)
    total_duration = sum(e["duration"] for e in events)
    return {
        "events": events,
        "total_duration_ms": total_duration,
        "count": len(events),
    }


@app.post("/api/process-audio")
async def process_audio_file(
    file: UploadFile = File(...),
    mode: str = Form("audio_only"),
    text: Optional[str] = Form(None),
):
    """
    Process an uploaded audio file (WAV or raw PCM) and return a viseme timeline.
    For MP3 support, the frontend should decode to WAV/PCM before sending.
    """
    content = await file.read()

    if mode not in ("hybrid", "audio_only", "text_only"):
        mode = "audio_only"

    # Try to read as WAV
    sample_rate, samples = _decode_audio_file(content)
    if samples is None:
        return {"error": "Could not decode audio file. Send WAV format (PCM int16 or float32)."}

    # Process in chunks
    processor = AudioProcessor(sample_rate=sample_rate, chunk_size=1024)
    engine = SyncEngine(mode=mode)

    # If text provided, generate text visemes
    if text:
        text_proc = TextProcessor()
        text_events = text_proc.process_text(text)
        engine.push_text_visemes(text_events)

    timeline = []
    chunk_size = 1024
    time_per_chunk = chunk_size / sample_rate

    for i in range(0, len(samples), chunk_size):
        chunk = samples[i : i + chunk_size]
        if len(chunk) == 0:
            break

        # Pad short final chunk
        if len(chunk) < chunk_size:
            chunk = np.pad(chunk, (0, chunk_size - len(chunk)))

        audio_bytes = chunk.astype(np.float32).tobytes()
        audio_result = processor.process_chunk(audio_bytes, format="float32")
        viseme_state = engine.update_audio(audio_result)

        timestamp_ms = (i / sample_rate) * 1000
        timeline.append({
            "time_ms": round(timestamp_ms, 1),
            "viseme": viseme_state["target_viseme"],
            "label": viseme_state["label"],
            "energy": audio_result["smoothed_energy"],
        })

    # Deduplicate consecutive same-viseme entries
    deduped = []
    for entry in timeline:
        if not deduped or deduped[-1]["viseme"] != entry["viseme"]:
            deduped.append(entry)

    return {
        "timeline": deduped,
        "duration_ms": round((len(samples) / sample_rate) * 1000, 1),
        "sample_rate": sample_rate,
        "total_events": len(deduped),
    }


# --- WebSocket Endpoint ---

@app.websocket("/ws/audio")
async def websocket_audio(websocket: WebSocket):
    """
    Real-time audio streaming endpoint.

    Protocol:
      Client sends:
        - JSON config: {"type": "config", "sample_rate": 44100, "mode": "hybrid", "text": "..."}
        - Binary audio chunks (float32 PCM)
        - JSON text updates: {"type": "text", "text": "new text..."}

      Server responds:
        - JSON viseme state on each audio chunk
    """
    await websocket.accept()

    processor = AudioProcessor()
    engine = SyncEngine()
    text_proc = TextProcessor()

    try:
        while True:
            data = await websocket.receive()

            if "text" in data:
                # JSON message
                msg = json.loads(data["text"])
                msg_type = msg.get("type", "")

                if msg_type == "config":
                    sample_rate = msg.get("sample_rate", 44100)
                    mode = msg.get("mode", "hybrid")
                    if mode not in ("hybrid", "audio_only", "text_only"):
                        mode = "hybrid"
                    processor = AudioProcessor(sample_rate=sample_rate)
                    engine = SyncEngine(mode=mode)

                    text = msg.get("text", "")
                    if text:
                        events = text_proc.process_text(text)
                        engine.push_text_visemes(events)

                    await websocket.send_json({
                        "type": "config_ack",
                        "sample_rate": sample_rate,
                        "mode": mode,
                    })

                elif msg_type == "text":
                    text = msg.get("text", "")
                    events = text_proc.process_text(text)
                    engine.push_text_visemes(events)
                    await websocket.send_json({
                        "type": "text_ack",
                        "viseme_count": len(events),
                    })

                elif msg_type == "mode":
                    engine.set_mode(msg.get("mode", "hybrid"))
                    await websocket.send_json({
                        "type": "mode_ack",
                        "mode": engine.mode,
                    })

                elif msg_type == "reset":
                    processor.reset()
                    engine.reset()
                    await websocket.send_json({"type": "reset_ack"})

            elif "bytes" in data:
                # Binary audio data
                audio_bytes = data["bytes"]
                audio_result = processor.process_chunk(audio_bytes, format="float32")
                viseme_state = engine.update_audio(audio_result)

                await websocket.send_json({
                    "type": "viseme",
                    **viseme_state,
                    "energy": audio_result["smoothed_energy"],
                    "is_onset": audio_result["is_onset"],
                    "bands": audio_result["bands"],
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# --- Helpers ---

def _decode_audio_file(content: bytes) -> tuple:
    """
    Decode audio file bytes to (sample_rate, float32_samples).
    Supports WAV (int16, int32, float32).
    Returns (0, None) on failure.
    """
    try:
        buf = io.BytesIO(content)
        with wave.open(buf, 'rb') as wf:
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            n_frames = wf.getnframes()
            raw = wf.readframes(n_frames)

        if sample_width == 2:
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 4:
            samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            # Try float32
            samples = np.frombuffer(raw, dtype=np.float32)

        # Convert stereo to mono
        if n_channels == 2:
            samples = samples.reshape(-1, 2).mean(axis=1)
        elif n_channels > 2:
            samples = samples.reshape(-1, n_channels).mean(axis=1)

        return sample_rate, samples

    except Exception:
        # Try raw float32 PCM as fallback
        try:
            samples = np.frombuffer(content, dtype=np.float32)
            if len(samples) > 0:
                return 44100, samples
        except Exception:
            pass

        return 0, None


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
