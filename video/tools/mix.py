"""Mixes the video's sound: narration, the film score and the game's sounds.

    python -I video/tools/mix.py [video-dir]

Reads video/film/plan.json, video/audio/build/score.wav, video/audio/build/fx.wav
and the narration clips, and writes video/audio/build/mix.wav (48 kHz stereo)
plus video/audio/build/mix-report.json.

- Every narration line is levelled to the same loudness.
- The music sits under everything and dips under the voice (a smooth envelope
  from the plan, not a pumping compressor): about 8 dB down while someone speaks.
- Game sounds dip a little under the voice.
- The sum is loudness-normalized with ffmpeg loudnorm (two passes) to
  -16 LUFS integrated, -1.5 dBTP, so nothing clips.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

VIDEO = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
import os

CUT = os.environ.get("CUT", "demo")
BUILD = VIDEO / "audio" / ("build" if CUT == "demo" else f"build-{CUT}")
RATE = 48000


# A broadcast polish for the narrator: low rumble out, a lift where speech is
# clear and bright (3 kHz), a little air, and gentle compression so every word
# stays forward and smiling over the music.
VOICE_CHAIN = "highpass=f=90,equalizer=f=3200:t=q:w=1.1:g=3,highshelf=f=9000:g=2.5,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=140:makeup=2"


def load(path: Path, chain: str | None = None) -> np.ndarray:
    args = ["ffmpeg", "-v", "error", "-i", str(path)] + (["-af", chain] if chain else []) + ["-ac", "2", "-ar", str(RATE), "-f", "f32le", "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def rms_db(x: np.ndarray, gate: float = 1e-3) -> float:
    m = np.abs(x).mean(axis=1)
    keep = x[m > gate]
    if len(keep) == 0:
        return -120.0
    return float(20 * np.log10(np.sqrt((keep**2).mean()) + 1e-12))


def db(v: float) -> float:
    return 10 ** (v / 20)


plan = json.loads((VIDEO / ("film" if CUT == "demo" else f"film-{CUT}") / "plan.json").read_text(encoding="utf-8"))
n = int((plan["duration"] + 0.5) * RATE)

# ---- narration
voice = np.zeros((n, 2))
VOICE_RMS = -19.0
for v in plan["voice"]:
    x = load(VIDEO / v["file"], VOICE_CHAIN)
    x *= db(VOICE_RMS - rms_db(x))
    a = int(v["start"] * RATE)
    b = min(n, a + len(x))
    voice[a:b] += x[: b - a]

# Speaking envelope: 1 while a line plays, eased in 0.25 s before and out 0.6 s after.
env = np.zeros(n)
for v in plan["voice"]:
    a = int((v["start"] - 0.25) * RATE)
    b = int((v["start"] + v["dur"] + 0.15) * RATE)
    env[max(0, a) : min(n, b)] = 1.0
# Smooth: attack 0.25 s, release 0.6 s, as a one-pole follower run at 1 kHz then upsampled.
step = RATE // 1000
coarse = env[::step]
out = np.zeros_like(coarse)
level = 0.0
for i, target in enumerate(coarse):
    k = 1 / (0.25 * 1000) if target > level else 1 / (0.6 * 1000)
    level += (target - level) * min(1.0, k * 4)
    out[i] = level
duck = np.repeat(out, step)[:n]
if len(duck) < n:
    duck = np.pad(duck, (0, n - len(duck)), mode="edge")

# ---- music
score = load(BUILD / "score.wav")[:n]
score = np.pad(score, ((0, n - len(score)), (0, 0)))
MUSIC_BED = -22.5  # with nobody speaking: warm and present between lines
music_gain = db(MUSIC_BED - rms_db(score))
music_curve = music_gain * (1 - duck * (1 - db(-10.0)))
music = score * music_curve[:, None]
# The last seconds: a gentle fade so the held chord ends in silence.
fade = int(2.5 * RATE)
music[n - fade :] *= np.linspace(1, 0, fade)[:, None] ** 1.5

# ---- game sounds and card sounds
fx = load(BUILD / "fx.wav")[:n]
fx = np.pad(fx, ((0, n - len(fx)), (0, 0)))
FX_LEVEL = -24.5
fx_gain = db(FX_LEVEL - rms_db(fx, gate=3e-3))
fx = fx * (fx_gain * (1 - duck * (1 - db(-3.0))))[:, None]

mix = voice + music + fx
# Headroom before the loudness pass, so no sample is ever clipped.
mix *= min(1.0, 0.5 / max(1e-9, float(np.abs(mix).max())))
pre = BUILD / "mix-pre.wav"
pcm = np.clip(mix, -1, 1)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(RATE), "-ac", "2", "-i", "-", "-c:a", "pcm_s24le", str(pre)], input=pcm.astype(np.float64).tobytes(), check=True)

# ---- loudness, two passes
first = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(pre), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
stats = json.loads(first[first.rindex("{") : first.rindex("}") + 1])
final = BUILD / "mix.wav"
flt = (
    "loudnorm=I=-16:TP=-1.5:LRA=11:"
    f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:"
    f"measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true:print_format=json"
)
second = subprocess.run(["ffmpeg", "-hide_banner", "-y", "-i", str(pre), "-af", flt, "-ar", str(RATE), "-c:a", "pcm_s24le", str(final)], capture_output=True, text=True).stderr
after = json.loads(second[second.rindex("{") : second.rindex("}") + 1])

report = {
    "duration": plan["duration"],
    "voice_rms_db": VOICE_RMS,
    "music_bed_db": MUSIC_BED,
    "music_duck_db": -8.0,
    "fx_db": FX_LEVEL,
    "stems": {"voice": rms_db(voice), "music": rms_db(music), "fx": rms_db(fx, 3e-3)},
    "loudnorm_in": stats,
    "loudnorm_out": after,
}
(BUILD / "mix-report.json").write_text(json.dumps(report, indent=1))
print(json.dumps({"in_I": stats["input_i"], "in_TP": stats["input_tp"], "out_I": after["output_i"], "out_TP": after["output_tp"], "out_LRA": after["output_lra"], "stems": report["stems"]}, indent=1))
