"""Tests for FastAPI endpoints."""

import io
import struct
import wave
import json
import numpy as np
import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
def transport():
    return ASGITransport(app=app)


@pytest.mark.asyncio
async def test_health_check(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["viseme_count"] == 12


@pytest.mark.asyncio
async def test_list_visemes(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/visemes")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["visemes"]) == 12
    assert data["visemes"][0]["label"] == "Neutral"
    assert data["visemes"][0]["index"] == 0
    assert data["visemes"][11]["label"] == "W-Oo"
    assert data["visemes"][11]["index"] == 11

    # Every viseme should have index, label, description
    for v in data["visemes"]:
        assert "index" in v
        assert "label" in v
        assert "description" in v


@pytest.mark.asyncio
async def test_process_text(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/process-text",
            json={"text": "hello world", "speed": 1.0},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "events" in data
    assert "total_duration_ms" in data
    assert "count" in data
    assert data["count"] > 0
    assert data["total_duration_ms"] > 0

    # Check event structure
    for event in data["events"]:
        assert "viseme" in event
        assert "duration" in event
        assert 0 <= event["viseme"] <= 11
        assert event["duration"] > 0


@pytest.mark.asyncio
async def test_process_text_empty(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/process-text",
            json={"text": "", "speed": 1.0},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == 0
    assert data["events"] == []


@pytest.mark.asyncio
async def test_process_text_speed(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        normal = await client.post("/api/process-text", json={"text": "test", "speed": 1.0})
        fast = await client.post("/api/process-text", json={"text": "test", "speed": 2.0})

    normal_dur = normal.json()["total_duration_ms"]
    fast_dur = fast.json()["total_duration_ms"]
    assert fast_dur < normal_dur


def _make_wav_bytes(duration_s=0.5, sample_rate=16000, freq=440, amplitude=0.5):
    """Generate a WAV file in memory with a sine tone."""
    n_samples = int(sample_rate * duration_s)
    t = np.linspace(0, duration_s, n_samples, dtype=np.float64)
    samples = (np.sin(2 * np.pi * freq * t) * amplitude * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(samples.tobytes())
    buf.seek(0)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_process_audio_file(transport):
    wav_bytes = _make_wav_bytes(duration_s=0.5, amplitude=0.5)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/process-audio",
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
            data={"mode": "audio_only"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "timeline" in data
    assert "duration_ms" in data
    assert "total_events" in data
    assert data["total_events"] > 0
    assert data["duration_ms"] > 400  # ~500ms file

    for entry in data["timeline"]:
        assert "time_ms" in entry
        assert "viseme" in entry
        assert "label" in entry
        assert 0 <= entry["viseme"] <= 11


@pytest.mark.asyncio
async def test_process_audio_with_text(transport):
    wav_bytes = _make_wav_bytes(duration_s=0.5)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/process-audio",
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
            data={"mode": "hybrid", "text": "hello"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_events"] > 0


@pytest.mark.asyncio
async def test_process_audio_silent_file(transport):
    """A silent file should produce mostly Neutral visemes."""
    wav_bytes = _make_wav_bytes(duration_s=0.5, amplitude=0.0)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/process-audio",
            files={"file": ("silent.wav", wav_bytes, "audio/wav")},
            data={"mode": "audio_only"},
        )
    assert resp.status_code == 200
    data = resp.json()
    # After silence timeout, should settle on Neutral (0)
    # The last entry should definitely be Neutral
    if data["timeline"]:
        last_entry = data["timeline"][-1]
        assert last_entry["viseme"] == 0


@pytest.mark.asyncio
async def test_process_audio_bad_file(transport):
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/process-audio",
            files={"file": ("bad.wav", b"not audio data", "audio/wav")},
            data={"mode": "audio_only"},
        )
    assert resp.status_code == 200
    data = resp.json()
    # Should either return error or handle gracefully
    assert "error" in data or "timeline" in data
