"""Evens out the narration's pace: slows lines read too fast, lifts lines read too slowly.

    python -I video/tools/pace_voice.py [demo]

Excited lines from an expressive voice can come out faster than a listener
can follow. For each line in video/script/<name>.json this measures spoken
words per second (pauses included) and, above MAX_WPS, slows the clip with
FFmpeg's pitch-preserving atempo filter (never below 0.8x). The untouched take
is kept in video/audio/voice/raw/. Updates the seconds in lines.json.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent
VOICE = VIDEO / "audio" / "voice"
RAW = VOICE / "raw"
MAX_WPS = 3.7
TARGET_WPS = 3.45
# A sleepy read loses the listener: lines under MIN_WPS are lifted toward LIFT_WPS (1.18x at most).
MIN_WPS = 3.0
LIFT_WPS = 3.2


def seconds(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "demo"
    only = set(sys.argv[2:])  # optional line ids: pace just these
    script = json.loads((VIDEO / "script" / f"{name}.json").read_text(encoding="utf-8"))
    index_file = VOICE / "lines.json"
    index = json.loads(index_file.read_text(encoding="utf-8"))
    RAW.mkdir(exist_ok=True)
    for line in [l for s in script["sections"] for l in s["lines"]]:
        if only and line["id"] not in only:
            continue
        wav = VOICE / f"{line['id']}.wav"
        raw = RAW / wav.name
        if not raw.exists():
            shutil.copyfile(wav, raw)
        words = len(line["text"].replace("-", " ").split())
        secs = seconds(raw)
        wps = words / secs
        k = 1.0
        if wps > MAX_WPS:
            k = max(0.85, TARGET_WPS / wps)
        elif wps < MIN_WPS:
            k = min(1.18, LIFT_WPS / wps)
        # A line with a hard time slot (the 30-second cut) is sped up a little to fit it: 1.15x at most, or the line's maxSpeed.
        if line.get("maxSeconds") and secs / k > line["maxSeconds"]:
            k = min(line.get("maxSpeed", 1.15), secs / line["maxSeconds"])
        if abs(k - 1) > 0.005:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-filter:a", f"atempo={k:.3f}", "-ar", "24000", "-ac", "1", str(wav)], check=True)
            print(f"{line['id']}: {wps:.2f} words/s, played at {k:.2f}x")
        else:
            shutil.copyfile(raw, wav)
        index[line["id"]]["seconds"] = round(seconds(wav), 3)
    index_file.write_text(json.dumps(index, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
