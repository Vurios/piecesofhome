"""Scores narration takes, so the voice kit can keep the best of several.

Two checks per take:

- Words: Whisper (small.en, run locally) transcribes the take, and the word
  error rate against the script must be as low as the best take's (ideally 0).
  Both sides go through Whisper's English normalizer, so "1969" and "nineteen
  sixty-nine" count as the same words.
- Liveliness: how much the pitch moves (semitones, spread of the voiced frames)
  and how much the loudness moves. A flat, sleepy read scores low; a smiling,
  bouncy read scores high. The pace must stay easy to follow.

Used by tts_chatterbox.py when TAKES is above 1.
"""
from __future__ import annotations

import numpy as np

_asr = None


def _pipeline():
    global _asr
    if _asr is None:
        import torch
        from transformers import pipeline

        cuda = torch.cuda.is_available()
        # Half precision on the GPU: half the memory, so it sits beside Chatterbox without spilling.
        _asr = pipeline("automatic-speech-recognition", model="openai/whisper-small.en", device=0 if cuda else -1, torch_dtype=torch.float16 if cuda else torch.float32)
    return _asr


def _norm(text: str) -> list[str]:
    tok = _pipeline().tokenizer
    return tok.normalize(text).split()


def wer(ref: str, hyp: str) -> float:
    r, h = _norm(ref), _norm(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), dtype=np.int32)
    d[:, 0] = np.arange(len(r) + 1)
    d[0, :] = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return float(d[len(r), len(h)]) / max(1, len(r))


def transcribe(x: np.ndarray, sr: int) -> str:
    import librosa

    y = librosa.resample(x.astype(np.float32), orig_sr=sr, target_sr=16000)
    return _pipeline()({"raw": y, "sampling_rate": 16000})["text"]


def liveliness(x: np.ndarray, sr: int) -> dict[str, float]:
    import librosa

    y = librosa.resample(x.astype(np.float32), orig_sr=sr, target_sr=16000)
    f0 = librosa.yin(y, fmin=90, fmax=600, sr=16000, frame_length=1024, hop_length=160)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=160)[0]
    n = min(len(f0), len(rms))
    f0, rms = f0[:n], rms[:n]
    voiced = rms > max(1e-4, float(np.percentile(rms, 60)) * 0.35)
    v = f0[voiced]
    v = v[(v > 100) & (v < 550)]
    if len(v) < 10:
        return {"f0": 0.0, "pitch": 0.0, "loud": 0.0, "score": 0.0}
    st = 12 * np.log2(v / np.median(v))
    db = 20 * np.log10(rms[voiced] + 1e-6)
    pitch = float(np.std(st))
    loud = float(np.std(db))
    return {"f0": float(np.median(v)), "pitch": pitch, "loud": loud, "score": pitch + 0.4 * loud}


def score(x: np.ndarray, sr: int, text: str) -> dict[str, float | str]:
    said = transcribe(x, sr)
    live = liveliness(x, sr)
    words = len(text.replace("-", " ").split())
    secs = len(x) / sr
    wps = words / max(0.1, secs)
    # Lively but easy to follow: about 2.8 to 3.9 words a second (a slow take sounds sleepy).
    pace = max(0.0, 2.8 - wps) + max(0.0, wps - 3.9)
    return {"wer": wer(text, said), "said": said.strip(), "wps": wps, "secs": secs, **live, "pace": pace}
