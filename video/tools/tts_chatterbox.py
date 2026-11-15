"""Narration with Chatterbox (Resemble AI, MIT license), run locally (GPU if there is one).

    video/.tts-venv/Scripts/python.exe video/tools/tts_chatterbox.py [demo] [line-id ...]

TAKES=n reads every sentence n times (different seeds) and keeps the best
take: the words must be right (Whisper checks them, see voice_score.py), and
among those the liveliest read at an easy pace wins. A line with maxSeconds
also prefers takes that fit its slot without being sped up. Every take's
scores go to video/audio/voice/takes.json.

Reads video/script/<name>.json. Each line has a "mood"; the mood sets how much
emotion the voice puts in (Chatterbox's "exaggeration") and how closely it
follows its pacing guide ("cfg_weight"). Lines are read sentence by sentence
and joined with short natural pauses, so long lines stay steady. Writes
video/audio/voice/<id>.wav (24 kHz mono) and updates video/audio/voice/lines.json.

Chatterbox marks its audio with an inaudible watermark (Resemble's Perth),
which is fine: the narration is synthetic and AI_USE.md says so.
"""
import json
import os
import re
import sys
import time
import wave
from pathlib import Path

import numpy as np
import torch
from chatterbox.tts import ChatterboxTTS

VIDEO = Path(__file__).resolve().parent.parent
VOICE = VIDEO / "audio" / "voice"

# Words the voice should say a certain way (the screen keeps the real spelling).
SAY = [(r"Hackstreet", "Hack-street"), (r"\bRemi's\b", "Remmy's"), (r"\bRemi\b", "Remmy")]

# (exaggeration, cfg_weight, temperature). A fun, smiling storyteller: plenty of
# expression, and a pacing guide strong enough to keep the read moving (more
# exaggeration than this drags the words out). The bright, quick read itself
# comes from the reference clip (spark-quick.wav, see video/README.md).
MOOD = {
    "hushed": (0.55, 0.6, 0.8),
    "tender": (0.6, 0.58, 0.82),
    "curious": (0.7, 0.58, 0.85),
    "bright": (0.75, 0.57, 0.85),
    "excited": (0.9, 0.55, 0.85),
    "proud": (0.72, 0.58, 0.84),
    "awe": (0.62, 0.6, 0.82),
}


def sentences(text: str) -> list[tuple[str, float]]:
    """Splits a line into sentences, each with the pause that follows it."""
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    out = []
    for p in parts:
        if not p:
            continue
        pause = 0.3 if p.endswith(("!", "?")) else 0.26
        out.append((p, pause))
    return out


def trim(x: np.ndarray, sr: int, pad: float = 0.04) -> np.ndarray:
    """Cuts silence at both ends (keeps a little air)."""
    a = np.abs(x)
    win = int(sr * 0.01)
    env = np.convolve(a, np.ones(win) / win, mode="same")
    thr = max(1e-4, env.max() * 0.02)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return x
    s = max(0, idx[0] - int(pad * sr))
    e = min(len(x), idx[-1] + int(pad * sr * 2))
    return x[s:e]


def write_wav(path: Path, x: np.ndarray, sr: int) -> None:
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main() -> None:
    args = sys.argv[1:]
    name = "demo"
    if args and not args[0].count("-"):
        name = args.pop(0)
    script = json.loads((VIDEO / "script" / f"{name}.json").read_text(encoding="utf-8"))
    lines = [l for s in script["sections"] for l in s["lines"]]
    if args:
        lines = [l for l in lines if l["id"] in args]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
    takes = max(1, int(os.environ.get("TAKES", "1")))
    if takes > 1:
        from voice_score import score  # noqa: E402  (same folder)
    log_file = (Path(os.environ["VOICE_OUT"]) if os.environ.get("VOICE_OUT") else VOICE) / "takes.json"
    log = json.loads(log_file.read_text(encoding="utf-8")) if log_file.exists() else {}
    sr = model.sr
    # VOICE_REF: a short clip whose voice Chatterbox speaks in (for example a female
    # voice made with Kokoro). Without it, Chatterbox uses its built-in voice.
    ref = os.environ.get("VOICE_REF")
    if ref:
        model.prepare_conditionals(ref, exaggeration=0.6)
    voice_name = f"chatterbox, voice from {Path(ref).stem}" if ref else "chatterbox default"
    out_dir = Path(os.environ["VOICE_OUT"]) if os.environ.get("VOICE_OUT") else VOICE
    out_dir.mkdir(parents=True, exist_ok=True)
    index_file = (Path(os.environ["VOICE_OUT"]) if os.environ.get("VOICE_OUT") else VOICE) / "lines.json"
    index = json.loads(index_file.read_text(encoding="utf-8")) if index_file.exists() else {}
    for n, line in enumerate(lines):
        ex, cfg, temp = MOOD.get(line.get("mood", "bright"), MOOD["bright"])
        said = line["text"]
        for a, b in SAY:
            said = re.sub(a, b, said)
        chunks = []
        parts = sentences(said)
        # The script's own spelling, for checking what was said ("Remi", not the "Remmy" the voice reads).
        plain = [t for t, _ in sentences(line["text"])]
        if len(plain) != len(parts):
            plain = [t for t, _ in parts]
        line_words = max(1, len(said.replace("-", " ").split()))
        log[line["id"]] = []
        for i, (sent, pause) in enumerate(parts):
            seeds = os.environ.get("SEED", "0").split(",")  # one seed offset per sentence, or one for all
            base = 1000 + n * 17 + i + int(seeds[min(i, len(seeds) - 1)])
            # A slot for this sentence when the line has a hard length (the 30-second cut).
            budget = None
            if line.get("maxSeconds"):
                budget = line["maxSeconds"] * len(sent.replace("-", " ").split()) / line_words - pause
            best, best_key, best_k, tried = None, None, 0, []
            for k in range(takes):
                torch.manual_seed(base + k * 101)
                t0 = time.time()
                wav = model.generate(sent, exaggeration=ex, cfg_weight=cfg, temperature=temp)
                t_gen = time.time() - t0
                x = trim(wav.squeeze(0).cpu().numpy().astype(np.float32), sr)
                if takes == 1:
                    best = x
                    break
                t0 = time.time()
                sc = score(x, sr, plain[i])
                print(f"    take {k + 1}: generated in {t_gen:.1f} s, scored in {time.time() - t0:.1f} s", flush=True)
                over = max(0.0, sc["secs"] - budget) if budget else 0.0
                # Right words first; then lively, at an easy pace, inside its slot.
                key = (round(sc["wer"], 3), -(sc["score"] - 4.0 * sc["pace"] - 3.0 * over))
                tried.append({"take": k, "wer": round(sc["wer"], 3), "said": sc["said"], "secs": round(sc["secs"], 2), "wps": round(sc["wps"], 2), "pitch": round(sc["pitch"], 2), "loud": round(sc["loud"], 2), "over": round(over, 2)})
                if best_key is None or key < best_key:
                    best, best_key, best_k = x, key, k
            if tried:
                log[line["id"]].append({"sentence": sent, "kept": best_k, "takes": tried})
                t = tried[best_k]
                print(f"  {line['id']}.{i}: kept take {best_k + 1} of {takes} (WER {t['wer']}, pitch {t['pitch']}, {t['wps']} words/s)", flush=True)
            chunks.append(best)
            chunks.append(np.zeros(int(sr * pause), dtype=np.float32))
        x = np.concatenate(chunks[:-1]) if chunks else np.zeros(1, dtype=np.float32)
        peak = float(np.abs(x).max()) or 1.0
        x = x * (0.89 / peak)
        write_wav(out_dir / f"{line['id']}.wav", x, sr)
        secs = round(len(x) / sr, 3)
        index[line["id"]] = {"voice": voice_name, "model": "Chatterbox TTS 0.1.4 (ResembleAI/chatterbox)", "mood": line.get("mood"), "text": line["text"], "seconds": secs}
        index_file.write_text(json.dumps(index, indent=1), encoding="utf-8")
        if takes > 1:
            log_file.write_text(json.dumps(log, indent=1), encoding="utf-8")
        print(f"{line['id']}: {secs:.2f} s ({line.get('mood')})", flush=True)


if __name__ == "__main__":
    main()
