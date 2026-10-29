"""Sprecherstimmen: lokal mit Piper TTS (kostenlos, offline). Optional ElevenLabs, falls eingerichtet.

ElevenLabs wird nur benutzt, wenn die Umgebungsvariable ELEVENLABS_API_KEY gesetzt ist
(nie im Code oder in Dateien speichern). Stimmen-IDs optional über ELEVENLABS_VOICE_ERZ/_JON/_FUNK/_RADIO.
"""
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "..", "VOICE", "models")
CACHE = os.path.join(HERE, "..", "VOICE", "cache")
SR = 48000

# Rolle -> (Piper-Modell, length_scale, noise_scale, ffmpeg-Nachbearbeitung)
ROLE_CFG = {
    "ERZ": ("karlsson", 0.86, 0.6,
            "rubberband=pitch=0.9:pitchq=quality,highpass=f=60,equalizer=f=140:t=q:w=1:g=4,"
            "equalizer=f=3500:t=q:w=1:g=2,aecho=0.8:0.6:35:0.12"),
    "JON": ("thorsten", 0.9, 0.75,
            "rubberband=pitch=1.05:pitchq=quality,highpass=f=90,equalizer=f=3000:t=q:w=1:g=2"),
    "FUNK": ("thorsten", 1.0, 0.6,
             "rubberband=pitch=0.84:pitchq=quality,highpass=f=420,lowpass=f=2900,"
             "acrusher=bits=10:mix=0.35,equalizer=f=1500:t=q:w=1:g=6,volume=1.6,alimiter=limit=0.8"),
    "RADIO": ("kerstin", 0.88, 0.6, "highpass=f=320,lowpass=f=3600,equalizer=f=1800:t=q:w=1:g=4"),
}
ELEVEN_DEFAULT_VOICES = {"ERZ": "", "JON": "", "FUNK": "", "RADIO": ""}


def _model(name):
    d = os.path.join(MODELS, name)
    return os.path.join(d, f"de-{name}-low.onnx")


def available():
    """Welche Stimm-Engines sind nutzbar?"""
    res = {"piper": False, "elevenlabs": False}
    try:
        import piper  # noqa: F401
        res["piper"] = all(os.path.exists(_model(m)) for m in ("thorsten", "karlsson", "kerstin"))
    except ImportError:
        pass
    res["elevenlabs"] = bool(os.environ.get("ELEVENLABS_API_KEY"))
    return res


def _read_wav(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        return x, w.getframerate()


def _eleven(text, role, out_mp3):
    key = os.environ["ELEVENLABS_API_KEY"]
    vid = os.environ.get(f"ELEVENLABS_VOICE_{role}") or ELEVEN_DEFAULT_VOICES[role]
    if not vid:
        raise RuntimeError(f"Keine ElevenLabs-Stimme für {role} (ELEVENLABS_VOICE_{role})")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
        data=json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=60) as r, open(out_mp3, "wb") as f:
        f.write(r.read())


def synth(text, role, engine="piper"):
    """Erzeugt die Zeile als 48-kHz-Mono-Array (float32). Ergebnis wird gecacht."""
    os.makedirs(CACHE, exist_ok=True)
    model, ls, ns, post = ROLE_CFG[role]
    h = hashlib.sha1(f"{engine}|{role}|{text}|{ROLE_CFG[role]}".encode()).hexdigest()[:16]
    final = os.path.join(CACHE, f"{role}_{h}.wav")
    if not os.path.exists(final):
        raw = os.path.join(CACHE, f"{role}_{h}_raw")
        if engine == "elevenlabs":
            raw += ".mp3"
            _eleven(text, role, raw)
            post = ",".join(p for p in post.split(",") if not p.startswith("rubberband"))
        else:
            raw += ".wav"
            subprocess.run([sys.executable, "-m", "piper", "-m", _model(model), "--length-scale", str(ls),
                            "--noise-scale", str(ns), "--noise-w-scale", "0.85", "-f", raw],
                           input=text.encode(), check=True, capture_output=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-af",
                        f"aresample={SR},{post},silenceremove=start_periods=1:start_threshold=-45dB,"
                        f"areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                        "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", final], check=True)
        os.remove(raw)
    x, _ = _read_wav(final)
    return x / (np.abs(x).max() + 1e-9) * 0.8
