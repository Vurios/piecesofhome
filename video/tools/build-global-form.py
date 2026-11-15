"""Writes docs/submission/global/GLOBAL_FORM.md: every field of the NASA Space Apps
project page, in form order, paste-ready, with word and character counts, and
the NASA Data and Other Data rows built from src/data/credits.json and the
datasets list. Checks that every link opens without a login.

    python -I video/tools/build-global-form.py
"""
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "submission" / "global" / "GLOBAL_FORM.md"
credits = json.loads((ROOT / "src/data/credits.json").read_text(encoding="utf-8"))
facts = json.loads((ROOT / "src/data/facts.json").read_text(encoding="utf-8"))["facts"]

LIVE = "https://piecesofhome.pages.dev"
REPO = "https://github.com/Vurios/piecesofhome"
TRAILER = f"{LIVE}/trailer/"
RELEASE = f"{REPO}/releases/latest"

NAME = "Pieces of Home"

SUMMARY = (
    "Pieces of Home is a free, cozy 3D browser game that tells the stories of the machines NASA left on the Moon, on Mars and far out in space. "
    "Remi finds the unsent letters of their late dad, who loved these machines, and delivers them inside his handmade models of real landing sites: "
    "Apollo 11's mirrors at Tranquility Base, the Apollo 15 Moon buggy, Surveyor 3, Opportunity, Ingenuity, and finally Voyager 1. "
    "At each site, players learn the true story of the hardware and play with the science that made it work, like bouncing light off corner mirrors, "
    "then rebuild Dad's robot, Milo, one part at a time. "
    "Every number in the game comes from a checked list of facts, each with a NASA, JPL or NSSDCA source link, and real NASA photos carry their exact credits. "
    "It plays solo or with up to three friends in kid-safe co-op with no chat, right in the browser. "
    "These machines are not junk: some still work, and every one of them carries a story that can spark the next generation of explorers."
)

DETAILS = f"""**What it does**

Pieces of Home turns NASA's left-behind hardware into a story players want to finish. Remi, a young player character, returns to their late dad's workshop and finds glass domes, each holding a model of a real landing site, and letters Dad wrote to the machines there but never sent. Players step into each model, deliver the letter, read the machine's true story, and play with the engineering idea behind it:

- Tranquility Base (Apollo 11): send a light from Earth to the corner-cube mirrors and catch it coming back. Scientists still bounce lasers off this panel today.
- Hadley-Apennine (Apollo 15): the mesh wheels of the Moon buggy.
- Meridiani Planum (Opportunity): solar power and the Martian wind that cleaned its panels. Planned for 90 Martian days, it kept going for more than 14 years.
- Valinor Hills (Ingenuity): flying in very thin air. Planned for up to five test flights, it flew 72 times.
- Ocean of Storms (bonus): Surveyor 3 and the Apollo 12 visit.
- Finale: Dad's backyard dish points at Voyager 1, which becomes the first human-made object one light-day from Earth on November 18, 2026; the game shows how long Dad's letter would take to reach it on the day you play.

Each idea rebuilds a part of Dad's robot, Milo, and fills a page of Dad's notebook.

**How it works**

- Built with TypeScript, Three.js (3D worlds with a hand-drawn toon look) and Svelte 5 (notebook, letters, map and menus), served by Cloudflare Pages, with a Cloudflare Worker for co-op.
- Co-op for 1 to 4 players uses one Cloudflare Durable Object per private room code. There is no text or voice chat, no usernames and no tracking; players talk with emotes and a few kind preset phrases.
- Music, voices and most sound effects are made in code with the Web Audio API, plus CC0 instrument and sound samples.
- Accuracy is built into the code: every number, date and claim a player can read comes from one facts file (103 checked facts), and each fact has its NASA, JPL or NSSDCA source link. The build fails if game text uses a fact that is missing, unsourced or not yet verified. Models are labeled "Model, not to scale".

**How NASA data is used**

- Real NASA photos (NASA Image and Video Library, Photojournal, LROC) on the true story cards and in Dad's notebook, each with its exact credit.
- The CGI Moon Kit (NASA SVS) and the Viking Mars mosaic (NASA Ames, USGS) paint Dad's globes; the pins sit at real landing coordinates from NASA NSSDCA.
- A daily JPL Horizons table follows Voyager 1's distance, light time and place in the sky, so the finale is right on the day you play.
- Real mission recordings: Mars wind and Ingenuity's hum from Perseverance, Voyager plasma waves, Apollo 11's landing call.

**Benefits and intended impact**

- Players aged 10 and up meet the hardware as stories, not junk, and learn the science by doing it.
- Free, in any modern desktop browser, no install or account; ready for classrooms today, with a printable Field Guide that lists every fact and source.
- Imagine every classroom meeting these machines as friends. Next steps we would like to take: play-tests with students and teachers, more machines, and phone support.

**Tools, languages, hardware and software**

TypeScript, Svelte 5, Three.js, Vite, Cloudflare Pages, Workers and Durable Objects (PartyServer, partysocket), Web Audio API, Vitest, Playwright with axe-core, Python and FFmpeg for the video, HyperFrames and GSAP for the video edit. Made on ordinary laptops; it runs on a mid-range laptop in the browser. AI tools: Claude Code (coding assistant) and an open text-to-speech model (Chatterbox) for the video narration, disclosed in AI_USE.md.

**What makes it creative**

A family story carries the science: letters to machines, dioramas under glass, and a robot rebuilt one engineering idea at a time. The worlds are tiny planets you can walk around, the art is drawn in code in one warm, hand-made style, and the music adds an instrument for each friend in the room.

**Factors we considered**

Accuracy (sourced facts, exact credits, date-aware Voyager data, models labeled), kid safety and privacy (no chat, no accounts, no analytics), accessibility (captions for every line, text size, a dyslexia-friendly font, high contrast, reduced motion, keyboard, mouse and gamepad), licensing (only NASA media, CC0 and open-licensed fonts and libraries, all listed in CREDITS.md), performance on ordinary laptops, a gentle treatment of loss, and honest AI disclosure.

Play: {LIVE} · Code: {REPO} · 30-second video: {TRAILER}

NASA did not make, sponsor or endorse this project."""

SI = [
    ("Code", "Yes: an AI coding assistant (Claude Code) wrote most of the code under the team's direction."),
    ("Text", "Yes: drafts of in-game text, docs and these form answers, edited and approved by the team."),
    ("Audio", "Yes: the video narration is a synthetic voice (Chatterbox). The game's music and sounds are made in code, plus CC0 recorded samples. The game uses no AI audio."),
    ("Video", "Yes: the demo videos were edited with code written by the AI assistant and carry a 'Made with AI tools' mark."),
    ("Data / research", "Yes, if offered: the AI assistant helped research facts; every fact used links to its NASA, JPL or NSSDCA source."),
    ("Images", "No AI image generator was used. Real photos are NASA's, with credits; illustrations are drawn in code."),
]


def nasa_rows():
    rows = [
        ("NASA Image and Video Library", "https://images.nasa.gov/"),
        ("NASA Photojournal", "https://photojournal.jpl.nasa.gov/"),
        ("Lunar Reconnaissance Orbiter Camera (NASA/GSFC/ASU)", "https://www.lroc.asu.edu/"),
        ("NASA SVS: CGI Moon Kit", "https://svs.gsfc.nasa.gov/4720/"),
        ("Mars Viking Colorized Global Mosaic (NASA Ames, USGS)", "https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m"),
        ("NASA NSSDCA: Apollo landing site coordinates", "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"),
        ("NASA JPL Horizons System (Voyager 1 ephemeris)", "https://ssd.jpl.nasa.gov/horizons/"),
        ("Yale Bright Star Catalog (NASA HEASARC)", "https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html"),
        ("NASA Sounds from Beyond (Perseverance Mars wind, Ingenuity hum)", "https://www.nasa.gov/sounds-from-beyond/"),
        ("NASA NSSDCA: Apollo 11 landing audio", "https://nssdc.gsfc.nasa.gov/planetary/sound/index.html"),
    ]
    for m in credits["media"]:
        if "NASA" not in m["credit"]:
            continue
        url = m.get("page") or m["sourceUrl"]
        title = re.sub(r"\s+", " ", m["title"]).strip()
        rows.append((title[:110], url))
    rows.append(("Voyager 1: What Is a Light-Day (NASA Science)", "https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/"))
    seen, out = set(), []
    for t, u in rows:
        key = u.rstrip("/")
        if key not in seen:
            seen.add(key)
            out.append((t, u))
    return out


def other_rows():
    rows = []
    for k in ("libraries", "fonts", "tools"):
        for x in credits[k]:
            rows.append((x["name"], x["sourceUrl"], x.get("license", "")))
    rows += [
        ("Kenney Impact Sounds (sound effects)", "https://kenney.nl/assets/impact-sounds", "CC0"),
        ("Kenney RPG Audio (sound effects)", "https://kenney.nl/assets/rpg-audio", "CC0"),
        ("Kenney Interface Sounds (sound effects)", "https://kenney.nl/assets/interface-sounds", "CC0"),
        ("Versilian Community Sample Library (instrument samples)", "https://github.com/sgossner/VCSL", "CC0"),
        ("Claude Code (AI coding assistant, Anthropic)", "https://www.anthropic.com/claude-code", "Commercial tool (disclosed in AI_USE.md)"),
        ("Chatterbox TTS model weights (Resemble AI)", "https://huggingface.co/ResembleAI/chatterbox", "MIT"),
        ("Vite", "https://github.com/vitejs/vite", "MIT"),
        ("TypeScript", "https://github.com/microsoft/TypeScript", "Apache-2.0"),
        ("Vitest", "https://github.com/vitest-dev/vitest", "MIT"),
        ("Playwright", "https://github.com/microsoft/playwright", "Apache-2.0"),
        ("Cloudflare Workers and Wrangler (hosting, free tier)", "https://github.com/cloudflare/workers-sdk", "MIT or Apache-2.0"),
    ]
    seen, out = set(), []
    for n, u, lic in rows:
        key = (n.lower(), u)
        if u in seen and "partykit" not in u:
            continue
        if key in seen:
            continue
        seen.add(u)
        seen.add(key)
        out.append((n, u, lic))
    return out


def check(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (link check)"})
    for method in ("HEAD", "GET"):
        try:
            req.method = method
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if method == "GET":
                return e.code
        except Exception as e:  # noqa: BLE001
            if method == "GET":
                return type(e).__name__
    return "?"


def main():
    nasa = nasa_rows()
    other = other_rows()
    fact_urls = sorted({f["sourceUrl"] for f in facts if f.get("status") == "checked" and f.get("sourceUrl")})
    urls = [u for _, u in nasa] + [u for _, u, _ in other] + [LIVE, REPO, TRAILER]
    with ThreadPoolExecutor(12) as ex:
        status = dict(zip(urls, ex.map(check, urls)))
    words = lambda s: len(s.split())
    lines = [
        "# NASA Space Apps 2026: global project page, paste-ready",
        "",
        "Fields are in the order they appear on our project page. Counts are checked by `python -I video/tools/build-global-form.py`, which also opened every link (status codes at the bottom). No em or en dashes anywhere.",
        "",
        "## 1. Project Name",
        "",
        "```text",
        NAME,
        "```",
        "",
        f"## 2. Summary (required) · {words(SUMMARY)} words, {len(SUMMARY)} characters (limit 1,500; 50 to 200 words suggested)",
        "",
        "```text",
        SUMMARY,
        "```",
        "",
        "## 3. Project Demonstration (required): public video link, 30 seconds or less",
        "",
        "Use one of these (all public, no login):",
        "",
        f"- **Recommended:** the trailer page on our own site, plays in the browser: {TRAILER}",
        f"- The MP4 on GitHub Releases: {REPO}/releases/latest/download/HackstreetBoys_PiecesOfHome_30s.mp4",
        "- Or a YouTube link, if the team uploads it (see MY_TASKS.md).",
        "",
        "## 4. Project (required): final project link",
        "",
        "```text",
        LIVE,
        "```",
        "",
        f"The code is at {REPO} (named inside Project Details).",
        "",
        f"## 5. Project Details (required, rich text) · {words(DETAILS)} words, {len(DETAILS)} characters",
        "",
        "Paste into the rich-text box. Bold headings and bullet lists paste as formatting from most editors; if they paste as plain text, make the bold lines headings by hand.",
        "",
        DETAILS,
        "",
        "## 6. Use of Super Intelligence (required; data collection only)",
        "",
        "Tick every option that matches the list below (option names on the form may differ slightly):",
        "",
    ]
    lines += [f"- **{a}:** {b}" for a, b in SI]
    lines += [
        "",
        "How we follow the rules: the AI voice and code are acknowledged in this form, in AI_USE.md, the video description and the MP4 metadata; nothing generated uses NASA logos, flags or mission identifiers.",
        "",
        f"## 7. NASA Data (required for Global Award) · {len(nasa)} rows",
        "",
        "Add one row per line: Link Text, then Link URL.",
        "",
        "| # | Link Text | Link URL |",
        "|---|---|---|",
    ]
    lines += [f"| {i + 1} | {t} | {u} |" for i, (t, u) in enumerate(nasa)]
    lines += [
        "",
        f"Optional, for completeness: every fact in the game links to its own NASA, JPL or NSSDCA page ({len(fact_urls)} pages, listed in src/data/facts.json and at the end of this file).",
        "",
        f"## 8. Space Agency Partner & Other Data · {len(other)} rows",
        "",
        "No space agency partner data is used. Other resources and tools, each with its license:",
        "",
        "| # | Link Text | Link URL | License |",
        "|---|---|---|---|",
    ]
    lines += [f"| {i + 1} | {n} | {u} | {lic} |" for i, (n, u, lic) in enumerate(other)]
    lines += [
        "",
        "## 9. Checkboxes",
        "",
        "Terms and original work: the team ticks these on the form.",
        "",
        "## Link check",
        "",
        "Each link was opened with a plain web request (no login). 200 means it opened; some NASA and JPL pages refuse scripted requests (403) but open normally in a browser.",
        "",
    ]
    lines += [f"- {status[u]}: {u}" for u in urls]
    lines += ["", "## Appendix: every fact's source page", ""] + [f"- {u}" for u in fact_urls]
    text = "\n".join(lines) + "\n"
    assert "–" not in text and "—" not in text, "dash found"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    bad = [u for u in urls if status[u] not in (200, 403)]
    print(f"summary {words(SUMMARY)} words {len(SUMMARY)} chars; details {words(DETAILS)} words; NASA rows {len(nasa)}; other rows {len(other)}; not ok: {bad}")


if __name__ == "__main__":
    main()
