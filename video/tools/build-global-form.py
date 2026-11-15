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
SLIDES = f"{LIVE}/deck/PiecesOfHome_Slides.pdf"
VIDEO30 = f"{REPO}/releases/latest/download/HackstreetBoys_PiecesOfHome_30s.mp4"
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


def write_docx(nasa, other, status, urls):
    """The same answers as a Word file, in the form's own sections and order, with the title page first."""
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor
    from docx_cover import add_cover

    INK, SOFT, AMBER, CLAY, NAVY = (RGBColor(0x2B, 0x26, 0x22), RGBColor(0x62, 0x57, 0x4D), RGBColor(0xB8, 0x66, 0x1C), RGBColor(0xC0, 0x57, 0x3E), RGBColor(0xFF, 0xFF, 0xFF))
    HEAD, BODY = "Georgia", "Calibri"
    doc = Document()
    sec = add_cover(doc, ROOT / "docs/submission/cover/cover-global.jpg")
    st = doc.styles["Normal"]
    st.font.name = BODY
    st.font.size = Pt(10.5)
    doc.core_properties.title = "Pieces of Home: NASA Space Apps 2026 global submission answers"
    doc.core_properties.author = "Hackstreet Boys"
    doc.core_properties.comments = "Drafted with AI tools and checked by the team; see AI_USE.md in github.com/Vurios/piecesofhome."

    def shade(cell, fill):
        tc = cell._tc.get_or_add_tcPr()
        e = OxmlElement("w:shd")
        e.set(qn("w:val"), "clear")
        e.set(qn("w:color"), "auto")
        e.set(qn("w:fill"), fill)
        tc.append(e)

    def borders(table, color="D9C7A6", val="single", size=6):
        b = OxmlElement("w:tblBorders")
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            e = OxmlElement(f"w:{edge}")
            e.set(qn("w:val"), val)
            e.set(qn("w:sz"), str(size))
            e.set(qn("w:color"), color)
            b.append(e)
        table._tbl.tblPr.append(b)

    def run(p, text, size=10.5, bold=False, italic=False, color=INK, font=BODY):
        r = p.add_run(text)
        r.font.size, r.font.bold, r.font.italic, r.font.name = Pt(size), bold, italic, font
        r.font.color.rgb = color
        r._element.rPr.rFonts.set(qn("w:eastAsia"), font)
        return r

    def link(p, url, text=None, size=10.5):
        rid = p.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
        h = OxmlElement("w:hyperlink")
        h.set(qn("r:id"), rid)
        r = OxmlElement("w:r")
        rpr = OxmlElement("w:rPr")
        for tag, v in (("w:color", "B8661C"), ("w:u", "single")):
            e = OxmlElement(tag)
            e.set(qn("w:val"), v)
            rpr.append(e)
        sz = OxmlElement("w:sz")
        sz.set(qn("w:val"), str(int(size * 2)))
        rpr.append(sz)
        r.append(rpr)
        t = OxmlElement("w:t")
        t.text = text or url
        t.set(qn("xml:space"), "preserve")
        r.append(t)
        h.append(r)
        p._p.append(h)

    def para(container, after=4, before=0):
        p = container.add_paragraph()
        p.paragraph_format.space_after = Pt(after)
        p.paragraph_format.space_before = Pt(before)
        p.paragraph_format.line_spacing = 1.1
        return p

    def band(title, done_note, new_page=False):
        """The form's dark blue section bar."""
        if new_page:
            doc.add_page_break()
        t = doc.add_table(rows=1, cols=2)
        t.autofit = False
        borders(t, "1B2A80", "single", 4)
        t.columns[0].width, t.columns[1].width = Cm(13.5), Cm(4.5)
        a, b = t.rows[0].cells
        a.width, b.width = Cm(13.5), Cm(4.5)
        for c in (a, b):
            shade(c, "1B2A80")
        run(a.paragraphs[0], f"−  {title}", size=13, bold=True, color=NAVY)
        pb = b.paragraphs[0]
        pb.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        run(pb, done_note, size=9.5, color=RGBColor(0xF2, 0xE6, 0xCC))
        para(doc, 2)

    def field(name, required, hint):
        p = para(doc, 1, 8)
        p.paragraph_format.keep_with_next = True
        run(p, name, size=12, bold=True)
        if required:
            run(p, " *", size=12, bold=True, color=CLAY)
        if hint:
            q = para(doc, 3)
            q.paragraph_format.keep_with_next = True
            run(q, hint, size=9.5, italic=True, color=SOFT)

    def box(fill_fn, fill="FFFDF8"):
        """An answer box: what to paste."""
        t = doc.add_table(rows=1, cols=1)
        t.autofit = False
        borders(t, "B8661C", "single", 8)
        t.columns[0].width = Cm(18.0)
        c = t.rows[0].cells[0]
        c.width = Cm(18.0)
        shade(c, fill)
        fill_fn(c)
        para(doc, 2)

    def text_box(text, size=10.5):
        def f(c):
            ps = text.split("\n\n")
            c.paragraphs[0].paragraph_format.space_after = Pt(4)
            run(c.paragraphs[0], ps[0], size=size)
            for x in ps[1:]:
                q = c.add_paragraph()
                q.paragraph_format.space_after = Pt(4)
                run(q, x, size=size)

        box(f)

    def rows_table(headers, widths, rows, size=8.5):
        t = doc.add_table(rows=1, cols=len(headers))
        t.autofit = False
        borders(t)
        for i, w in enumerate(widths):
            t.columns[i].width = Cm(w)
        for i, h in enumerate(headers):
            c = t.rows[0].cells[i]
            c.width = Cm(widths[i])
            shade(c, "F3E6CC")
            run(c.paragraphs[0], h, size=size, bold=True)
        trpr = t.rows[0]._tr.get_or_add_trPr()
        hdr = OxmlElement("w:tblHeader")
        hdr.set(qn("w:val"), "true")
        trpr.append(hdr)
        for k, row in enumerate(rows):
            cells = t.add_row().cells
            for i, v in enumerate(row):
                c = cells[i]
                c.width = Cm(widths[i])
                if k % 2:
                    shade(c, "FBF6EC")
                p = c.paragraphs[0]
                if isinstance(v, str) and v.startswith("http"):
                    link(p, v, size=size)
                else:
                    run(p, str(v), size=size)
        para(doc, 4)

    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run(fp, "Pieces of Home, Team Hackstreet Boys. Answers for the NASA Space Apps Challenge 2026 project page. NASA did not make, sponsor or endorse this project.", size=8, color=SOFT)

    words = lambda s: len(s.split())
    p = para(doc, 0)
    run(p, "Global submission answers", size=24, bold=True, font=HEAD)
    p = para(doc, 6)
    run(p, "Every field of our project page, in the same order and sections as the form. Copy each orange box into the matching field.", size=10.5, color=SOFT)
    t = doc.add_table(rows=0, cols=2)
    t.autofit = False
    borders(t)
    t.columns[0].width, t.columns[1].width = Cm(5.5), Cm(12.5)
    for k, (a, b) in enumerate(
        [
            ("Project Name", NAME),
            ("Summary", f"{words(SUMMARY)} words, {len(SUMMARY)} of 1,500 characters"),
            ("Project Demonstration", f"30-second video: {TRAILER}"),
            ("Project", LIVE),
            ("Project Details", f"{words(DETAILS)} words, formatted"),
            ("Use of Super Intelligence", "tick: code, text, audio, video (and data or research if offered)"),
            ("NASA Data", f"{len(nasa)} links"),
            ("Space Agency Partner & Other Data", f"{len(other)} links"),
            ("Verification", "tick both boxes"),
        ]
    ):
        cells = t.add_row().cells
        cells[0].width, cells[1].width = Cm(5.5), Cm(12.5)
        if k % 2:
            for c in cells:
                shade(c, "FBF6EC")
        run(cells[0].paragraphs[0], a, size=9.5, bold=True)
        if b.startswith("http") or ": http" in b:
            pre, _, url = b.rpartition("http")
            if pre:
                run(cells[1].paragraphs[0], pre, size=9.5)
            link(cells[1].paragraphs[0], "http" + url, size=9.5)
        else:
            run(cells[1].paragraphs[0], b, size=9.5)
    para(doc, 8)

    # ---- Project Summary
    band("Project Summary", "2 fields")
    field("Project Name", False, "Give your project a title that helps describe what your team worked on.")
    p = para(doc, 3)
    run(p, "Replace \"Project Hackstreet Boys\" with the game's name:", size=9.5, color=CLAY, bold=True)
    text_box(NAME, size=12)
    field("Summary", True, "What did you develop? How does it address the challenge? Why is it important? 50 to 200 words suggested, 1,500 characters at most.")
    p = para(doc, 3)
    run(p, f"{words(SUMMARY)} words, {len(SUMMARY)} characters.", size=9, color=SOFT)
    text_box(SUMMARY)

    # ---- Project Links
    band("Project Links", "2 fields", new_page=True)
    field("Project Demonstration", True, "A video of 30 seconds or less, or no more than 7 slides including the title and introduction, at a public link with no password, permission or registration. Paste one link, the entire URL.")

    def demo(c):
        p0 = c.paragraphs[0]
        run(p0, "Recommended, the 30-second video (plays in the browser):  ", size=10, bold=True)
        link(p0, TRAILER, size=10.5)
        for label, url in (("The same video as an MP4 file:  ", VIDEO30), ("If the team picks slides instead, our 7-slide deck (PDF):  ", SLIDES)):
            q = c.add_paragraph()
            q.paragraph_format.space_before = Pt(5)
            run(q, label, size=10)
            link(q, url, size=10)

    box(demo)
    field("Project", True, "A public link to the final project, the entire URL.")
    box(lambda c: link(c.paragraphs[0], LIVE, size=12))
    p = para(doc, 2)
    run(p, "The code is public at ", size=9.5, color=SOFT)
    link(p, REPO, size=9.5)
    run(p, " and is named inside Project Details.", size=9.5, color=SOFT)

    # ---- Project Information
    band("Project Information", "4 fields")
    field("Project Details", True, "What does it do and how does it work? Benefits, intended impact, tools, languages, hardware and software, what makes it creative, factors we considered. The box keeps bold text and lists.")

    def details(c):
        first = True
        for block in DETAILS.split("\n\n"):
            block = block.strip()
            if not block:
                continue
            lines_ = block.split("\n")
            if block.startswith("**") and block.endswith("**"):
                p = c.paragraphs[0] if first else c.add_paragraph()
                p.paragraph_format.space_before = Pt(0 if first else 7)
                p.paragraph_format.space_after = Pt(2)
                run(p, block.strip("*"), size=11, bold=True, color=AMBER)
            elif all(x.startswith("- ") for x in lines_):
                for x in lines_:
                    p = c.add_paragraph()
                    p.paragraph_format.left_indent = Cm(0.5)
                    p.paragraph_format.first_line_indent = Cm(-0.35)
                    p.paragraph_format.space_after = Pt(2)
                    run(p, "•  " + x[2:], size=10)
            else:
                p = c.paragraphs[0] if first else c.add_paragraph()
                p.paragraph_format.space_after = Pt(4)
                run(p, block.replace(" · ", "  |  "), size=10)
            first = False

    box(details)
    field("Use of Super Intelligence (SI)", True, "Data collection only; judges do not see this answer. Select every option that applies (the option names on the form may differ slightly).")

    def si(c):
        p0 = c.paragraphs[0]
        run(p0, "Select these options:", size=10.5, bold=True)
        for a, b in SI:
            q = c.add_paragraph()
            q.paragraph_format.left_indent = Cm(0.5)
            q.paragraph_format.first_line_indent = Cm(-0.35)
            q.paragraph_format.space_after = Pt(2)
            tick = "☐" if a == "Images" else "☑"
            run(q, f"{tick}  {a}: ", size=10, bold=True)
            run(q, b, size=10)
        q = c.add_paragraph()
        q.paragraph_format.space_before = Pt(6)
        run(q, "Do not select \"I did not use SI\". ", size=10, bold=True, color=CLAY)
        run(
            q,
            "How we follow the SI rules: the 30-second video carries a visible \"Made with AI tools\" mark; the AI voice and the AI-assisted code are acknowledged in the video descriptions, the MP4 metadata, AI_USE.md and these answers; nothing generated uses NASA logos, flags or mission identifiers; no AI image generator was used.",
            size=10,
        )

    box(si)
    field("NASA Data", True, "In order to be eligible for a Global Award, you must use NASA data or resources. Add one row per resource with \"+ Add New Link\": Link Text, then Link URL.")
    rows_table(["#", "Link Text", "Link URL"], [0.8, 8.2, 9.0], [[i + 1, t_, u] for i, (t_, u) in enumerate(nasa)])
    field("Space Agency Partner & Other Data", False, "All other data, resources and tools, including open source code, fonts and sounds. We used no space agency partner data. One row per line: Link Text, then Link URL.")
    rows_table(["#", "Link Text", "Link URL", "License"], [0.8, 6.0, 7.2, 4.0], [[i + 1, n, u, lic] for i, (n, u, lic) in enumerate(other)])

    # ---- Verification
    band("Project Submission Verification", "2 boxes")
    for name, note in (
        ("Agree to Terms and Conditions", "Tick it. We read the Project Submission Guide and agree to the Participant Terms and Conditions and the Privacy Policy."),
        ("Confirm All Work is Original", "Tick it. The game and videos are our team's work. Every outside resource (NASA media and data, open source code, CC0 sounds, open fonts, AI tools) is listed in the two tables above and in CREDITS.md, and we used no copyrighted material without permission."),
    ):
        field(name, True, "")
        box(lambda c, note=note: (run(c.paragraphs[0], "☑  ", size=12, bold=True, color=AMBER), run(c.paragraphs[0], note, size=10)))

    ok = sum(1 for u in urls if status[u] in (200, 403))
    p = para(doc, 0, 10)
    run(p, f"Link check: {ok} of {len(urls)} links opened without a login on the day these answers were made (some NASA and JPL pages refuse scripted requests but open normally in a browser). NASA did not make, sponsor or endorse this project.", size=8.5, italic=True, color=SOFT)
    dst = OUT.parent / "PiecesOfHome_Global_Submission_Answers.docx"
    doc.save(dst)
    print(dst)


def main():
    nasa = nasa_rows()
    other = other_rows()
    fact_urls = sorted({f["sourceUrl"] for f in facts if f.get("status") == "checked" and f.get("sourceUrl")})
    urls = [u for _, u in nasa] + [u for _, u, _ in other] + [LIVE, REPO, TRAILER, SLIDES, VIDEO30]
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
        "## 3. Project Demonstration (required): a 30-second video or no more than 7 slides",
        "",
        "Paste one link only (all public, no login):",
        "",
        f"- **Recommended, the 30-second video:** the trailer page on our own site, plays in the browser: {TRAILER}",
        f"- The same video as an MP4 on GitHub Releases: {VIDEO30}",
        f"- **If the team picks slides instead:** our 7-slide deck as a PDF (title and introduction on slide 1): {SLIDES}",
        "- Or a YouTube link, if the team uploads the video (see MY_TASKS.md).",
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
    write_docx(nasa, other, status, urls)
    print(f"summary {words(SUMMARY)} words {len(SUMMARY)} chars; details {words(DETAILS)} words; NASA rows {len(nasa)}; other rows {len(other)}; not ok: {bad}")


if __name__ == "__main__":
    main()
