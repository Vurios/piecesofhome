"""Checks the finished video.

    python -I video/tools/qa.py [video-dir]

Writes video/out/qa.json and contact sheets (one frame every 2 seconds) to
video/out/qa/. Checks:

- duration, resolution, frame rate and codecs (ffprobe);
- loudness (EBU R128 integrated, true peak) and that no sample clips;
- no em or en dashes in captions, cards or the script;
- every number shown in captions and cards is listed with a fact ID or is a
  game, team or link number we allow on purpose;
- nothing that looks like an email, a phone number or a key on screen text.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

VIDEO = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
import os

CUT = os.environ.get("CUT", "demo")
FILM = VIDEO / ("film" if CUT == "demo" else f"film-{CUT}")
OUT = VIDEO / "out"
script = json.loads((VIDEO / "script" / f"{CUT}.json").read_text(encoding="utf-8"))
mp4 = OUT / script["file"]
report: dict = {"file": str(mp4)}

probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(mp4)], capture_output=True, text=True).stdout)
v = next(s for s in probe["streams"] if s["codec_type"] == "video")
a = next(s for s in probe["streams"] if s["codec_type"] == "audio")
subs = [s for s in probe["streams"] if s["codec_type"] == "subtitle"]
report["probe"] = {
    "duration_s": round(float(probe["format"]["duration"]), 2),
    "video": f'{v["codec_name"]} {v["width"]}x{v["height"]} {v["r_frame_rate"]} {v.get("pix_fmt")}',
    "audio": f'{a["codec_name"]} {a["sample_rate"]} Hz {a["channels"]} ch',
    "subtitles": [f'{s["codec_name"]} {s.get("tags", {}).get("language")}' for s in subs],
    "comment": probe["format"].get("tags", {}).get("comment", "")[:80],
    "size_mb": round(int(probe["format"]["size"]) / 1e6, 1),
}

r128 = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(mp4), "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
summary = r128[r128.rfind("Summary:") :]
grab = lambda pat: (re.search(pat, summary) or [None, None])[1]
report["loudness"] = {"integrated_LUFS": grab(r"I:\s+(-?[\d.]+) LUFS"), "LRA_LU": grab(r"LRA:\s+([\d.]+) LU"), "true_peak_dBFS": grab(r"Peak:\s+(-?[\d.]+) dBFS")}

# Contact sheets: a frame every 2 seconds, 6 x 5 per sheet.
sheets = OUT / ("qa" if CUT == "demo" else f"qa-{CUT}")
sheets.mkdir(exist_ok=True)
for old in sheets.glob("sheet-*.jpg"):
    old.unlink()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-vf", "fps=1/2,scale=384:-1,tile=6x5", str(sheets / "sheet-%02d.jpg")], check=True)
report["sheets"] = sorted(p.name for p in sheets.glob("sheet-*.jpg"))

# Text on screen: captions and the composition's own text.
html = (FILM / "index.html").read_text(encoding="utf-8")
# Rolling counters show passing values on the way to a checked number; only their last value is a claim.
html = re.sub(r'<span class="reel"[^>]*>(?:<i>\d+</i>)*?<i>(\d+)</i></span>', r" \1 ", html)
body = re.sub(r"<script.*?</script>|<style.*?</style>|<title>.*?</title>", " ", html, flags=re.S)
screen = re.sub(r"<[^>]+>", " ", body)
plan = json.loads((FILM / "plan.json").read_text(encoding="utf-8"))
captions = " ".join(c["text"] for c in plan["captions"])
text = screen + " " + captions
report["dashes"] = len(re.findall("[\u2013\u2014]", text + json.dumps(script, ensure_ascii=False)))

# Numbers on screen and the facts behind them.
allowed = {
    "2026": "event year; v1-light-day date",
    "1969": "a11-lrrr-placed",
    "1971": "lrv-first-drive; a14-lrrr",
    "2004": "opp-landing",
    "2018": "opp-last-contact",
    "2021": "ing-first-flight",
    "10": "opp-last-contact (June 10); audience: ages 10 and up",
    "18": "v1-light-day (November 18)",
    "90": "opp-planned",
    "14": "opp-years; Apollo 14 (mission name)",
    "100": "a11-lrrr-cubes",
    "72": "ing-72",
    "5": "ing-plan (up to five test flights)",
    "1": "1 to 4 players; Voyager 1; step numbers",
    "2": "step number",
    "3": "step number",
    "4": "1 to 4 players",
    "11": "Apollo 11 (mission name)",
    "15": "Apollo 15 (mission name)",
    "82": "Kokoro-82M (tool name)",
}
found = sorted(set(re.findall(r"\b\d+\b", text)), key=int)
report["numbers"] = {n: allowed.get(n, "CHECK") for n in found}
report["unchecked_numbers"] = [n for n in found if n not in allowed]
report["pii_like"] = re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{8,}\d|AIza[\w-]{20,}|sk-[\w-]{20,}", text)

(OUT / ("qa.json" if CUT == "demo" else f"qa-{CUT}.json")).write_text(json.dumps(report, indent=1, ensure_ascii=False))
print(json.dumps(report, indent=1, ensure_ascii=False))
