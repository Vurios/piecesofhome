"""Two-page project brief (Word) in the game's paper style.

    python -I video/tools/build-brief.py

Writes docs/submission/local/PiecesOfHome_Project_Brief.docx from the same
texts as the submission kit (description.md, datasets.md), with stills of the
real game (made by build-slides.ts in docs/submission/local/slides/img).

Run build-slides.ts first (it makes the stills), then this.
"""
import re
import subprocess
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

VIDEO = Path(__file__).resolve().parent.parent
ROOT = VIDEO.parent
OUT = ROOT / "docs" / "submission" / "local"
IMG = OUT / "slides" / "img"
IMG.mkdir(parents=True, exist_ok=True)

LIVE = "https://piecesofhome.pages.dev"
REPO = "https://github.com/Vurios/piecesofhome"
CHALLENGE = "Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars"
INK = RGBColor(0x2B, 0x26, 0x22)
SOFT = RGBColor(0x62, 0x57, 0x4D)
AMBER = RGBColor(0xB8, 0x66, 0x1C)
CLAY = RGBColor(0xC0, 0x57, 0x3E)
HEAD = "Georgia"
BODY = "Calibri"

# ---------------------------------------------------------------- stills
def crop(src: str, dst: str, vf: str) -> Path:
    out = IMG / dst
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(IMG / src), "-vf", vf, "-q:v", "2", str(out)], check=True)
    return out

band = crop("title.jpg", "brief-band.jpg", "crop=1920:520:0:30")
shots = [
    (crop("card.jpg", "brief-1.jpg", "crop=1440:810:240:200"), "Tranquility Base: a true story card"),
    (crop("mars.jpg", "brief-2.jpg", "crop=1440:810:240:150"), "Meridiani Planum, Mars"),
    (crop("dish.jpg", "brief-3.jpg", "crop=1440:810:240:120"), "The finale: finding Voyager 1"),
]

# ---------------------------------------------------------------- texts
desc_md = (OUT / "description.md").read_text(encoding="utf-8")
desc = desc_md.split("\n---\n")[1].strip()
desc = re.sub(r"for kids aged \d+ to \d+", "for players aged 10 and up", desc)
assert not re.search(r"aged \d+ to \d+", desc)
paras = [p.strip() for p in desc.split("\n\n") if p.strip()]
words = len(desc.split())
data_md = (OUT / "datasets.md").read_text(encoding="utf-8")
datasets = re.findall(r"^\d+\. (.*)$", data_md.split("## Details")[0], re.M)
assert len(datasets) == 9, datasets
readme = (ROOT / "README.md").read_text(encoding="utf-8")
team = [f"{n}: {r}" for n, r in re.findall(r"^\| ([A-Z][^|]+?) (?:\(team owner\) )?\| ([^|@]+?) \| @", readme, re.M)]
assert len(team) == 6, team


# ---------------------------------------------------------------- helpers
def shade(cell, hex_fill: str) -> None:
    tc = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc.append(shd)


def borders(table, color: str = "D9C7A6", size: int = 6) -> None:
    tbl = table._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{edge}")
        e.set(qn("w:val"), "single" if edge in ("top", "left", "bottom", "right") else "nil")
        e.set(qn("w:sz"), str(size))
        e.set(qn("w:color"), color)
        b.append(e)
    tbl.append(b)


def cell_margins(table, top=80, left=120, bottom=80, right=120) -> None:
    tbl = table._tbl.tblPr
    m = OxmlElement("w:tblCellMar")
    for k, v in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        e = OxmlElement(f"w:{k}")
        e.set(qn("w:w"), str(v))
        e.set(qn("w:type"), "dxa")
        m.append(e)
    tbl.append(m)


def run(p, text, size=10.5, bold=False, italic=False, color=INK, font=BODY):
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    r.font.name = font
    r._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    return r


def link(p, url, text, size=10.5):
    part = p.part
    rid = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    h = OxmlElement("w:hyperlink")
    h.set(qn("r:id"), rid)
    r = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    for tag, val in (("w:color", "B8661C"), ("w:u", "single")):
        e = OxmlElement(tag)
        e.set(qn("w:val"), val)
        rpr.append(e)
    f = OxmlElement("w:rFonts")
    f.set(qn("w:ascii"), BODY)
    f.set(qn("w:hAnsi"), BODY)
    rpr.append(f)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(int(size * 2)))
    rpr.append(sz)
    r.append(rpr)
    t = OxmlElement("w:t")
    t.text = text
    r.append(t)
    h.append(r)
    p._p.append(h)


def para(container, space_after=2, align=None):
    p = container.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(space_after)
    pf.line_spacing = 1.08
    if align:
        p.alignment = align
    return p


def heading(container, text, size=13, color=AMBER, before=6, after=2):
    p = para(container, after)
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.keep_with_next = True
    run(p, text, size=size, bold=True, color=color, font=HEAD)
    return p


# ---------------------------------------------------------------- document
doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
sec.left_margin = sec.right_margin = Cm(1.5)
sec.top_margin = Cm(1.2)
sec.bottom_margin = Cm(1.1)
WIDTH = Cm(18.0)
st = doc.styles["Normal"]
st.font.name = BODY
st.font.size = Pt(10.5)
doc.core_properties.title = "Pieces of Home: project brief"
doc.core_properties.author = "Hackstreet Boys"
doc.core_properties.comments = "Made with AI tools; see AI_USE.md in github.com/Vurios/piecesofhome."

# Footer
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
run(fp, "NASA did not make, sponsor or endorse this project. NASA images carry their credits. Made with AI tools: see AI_USE.md in our repo.", size=8, color=SOFT)

# Band picture
p = para(doc, 4)
p.add_run().add_picture(str(band), width=WIDTH)

# Title block
p = para(doc, 0)
run(p, "Pieces of Home", size=30, bold=True, font=HEAD)
p = para(doc, 6)
run(p, "A cozy browser adventure about the machines left on the Moon and Mars", size=13, italic=True, color=SOFT, font=HEAD)

# Info table: team on the left, challenge and links on the right
t = doc.add_table(rows=1, cols=2)
t.alignment = WD_TABLE_ALIGNMENT.CENTER
t.autofit = False
borders(t)
cell_margins(t, 100, 160, 100, 160)
widths = [Cm(7.0), Cm(11.0)]
for c, w in zip(t.rows[0].cells, widths):
    c.width = w
    shade(c, "FBF6EC")
a, b = t.rows[0].cells
a.paragraphs[0].paragraph_format.space_after = Pt(1)
run(a.paragraphs[0], "TEAM", size=8.5, bold=True, color=CLAY)
pa = para(a, 2)
run(pa, "Hackstreet Boys", size=13, bold=True, font=HEAD)
for name in team:
    pa = para(a, 0)
    run(pa, name.strip(), size=9.5)
b.paragraphs[0].paragraph_format.space_after = Pt(1)
run(b.paragraphs[0], "CHALLENGE", size=8.5, bold=True, color=CLAY)
pb = para(b, 6)
run(pb, CHALLENGE, size=11, bold=True, font=HEAD)
pb = para(b, 1)
run(pb, "NASA Space Apps Challenge 2026", size=9.5, color=SOFT)
pb = para(b, 1)
run(pb, "Play free: ", size=10, bold=True)
link(pb, LIVE, "piecesofhome.pages.dev", 10)
pb = para(b, 1)
run(pb, "Best on a laptop or desktop computer.", size=10, bold=True, color=RGBColor(0x55, 0x73, 0x58))
pb = para(b, 1)
run(pb, "Code: ", size=10, bold=True)
link(pb, REPO, "github.com/Vurios/piecesofhome", 10)
pb = para(b, 0)
run(pb, "Free, in the browser, no install or account. Ages 10 and up, 1 to 4 players.", size=9.5, color=SOFT)

# Description
heading(doc, "Project description", before=8)
for i, ptxt in enumerate(paras):
    p = para(doc, 4)
    p.paragraph_format.line_spacing = 1.1
    m = re.match(r"^(The problem:|Our solution:|NASA data:)\s*(.*)$", ptxt, re.S)
    if m:
        run(p, m.group(1) + " ", bold=True, color=AMBER)
        run(p, m.group(2))
    elif ptxt.startswith("Made with AI tools"):
        run(p, ptxt, size=9.5, italic=True, color=SOFT)
    else:
        run(p, ptxt)

# Pictures row: picture and caption in one cell, and the row never splits
t2 = doc.add_table(rows=1, cols=3)
t2.alignment = WD_TABLE_ALIGNMENT.CENTER
t2.autofit = False
cell_margins(t2, 30, 50, 10, 50)
trpr = t2.rows[0]._tr.get_or_add_trPr()
cs = OxmlElement("w:cantSplit")
trpr.append(cs)
for i, (img, cap) in enumerate(shots):
    c = t2.rows[0].cells[i]
    c.width = Cm(6.0)
    c.paragraphs[0].paragraph_format.space_after = Pt(1)
    c.paragraphs[0].add_run().add_picture(str(img), width=Cm(5.8))
    pc = para(c, 0)
    run(pc, cap, size=8.5, italic=True, color=SOFT)

# NASA data
heading(doc, "NASA data used", before=4)
for i, d in enumerate(datasets, start=1):
    p = para(doc, 2)
    p.paragraph_format.left_indent = Cm(0.6)
    p.paragraph_format.first_line_indent = Cm(-0.6)
    m = re.match(r"^(.*?\))(:.*)$", d)
    run(p, f"{i}.  ", size=10, bold=True, color=AMBER)
    if m:
        run(p, m.group(1), size=10, bold=True)
        run(p, m.group(2), size=10)
    else:
        run(p, d, size=10)
p = para(doc, 0)
run(p, "Every source, with its full link and how the game uses it: docs/submission/local/datasets.md in our repo. Every fact in the game has its source link in src/data/facts.json.", size=9, italic=True, color=SOFT)

# How it plays, and who it is for (the same points as the slides)
t3 = doc.add_table(rows=1, cols=2)
t3.alignment = WD_TABLE_ALIGNMENT.CENTER
t3.autofit = False
borders(t3)
cell_margins(t3, 100, 160, 100, 160)
left, right = t3.rows[0].cells
for c in (left, right):
    c.width = Cm(9.0)
    shade(c, "FBF6EC")
run(left.paragraphs[0], "How it plays", size=13, bold=True, color=AMBER, font=HEAD)
for i, step in enumerate(["Pick a glass dome, and a little rocket flies you to a real landing site.", "Deliver Dad's letter to the machine left there.", "Read its true story card: a real NASA photo, its credit and the source link.", "Play the big idea that made it work, and bring a new part home to Milo."], start=1):
    pl = para(left, 3)
    pl.paragraph_format.left_indent = Cm(0.6)
    pl.paragraph_format.first_line_indent = Cm(-0.6)
    run(pl, f"{i}.  ", size=10, bold=True, color=AMBER)
    run(pl, step, size=10)
run(right.paragraphs[0], "Safe, inclusive, easy to start", size=13, bold=True, color=AMBER, font=HEAD)
for item in ["Free, in the browser. No install, no account, no ads, no tracking.", "Ages 10 and up. 1 to 4 players with a private room code.", "No chat: only emotes and kind preset phrases.", "Captions for every line, a calmer motion setting, a dyslexia-friendly font, keyboard, mouse or gamepad, and a printable Field Guide."]:
    pr = para(right, 3)
    pr.paragraph_format.left_indent = Cm(0.5)
    pr.paragraph_format.first_line_indent = Cm(-0.5)
    run(pr, "•  ", size=10, bold=True, color=CLAY)
    run(pr, item, size=10)

heading(doc, "Accurate by design", before=8)
for item in ["Every number a player sees comes from one facts file, and each fact the game uses has its NASA, JPL or NSSDCA source link.", "The build fails if the game uses a fact with no source.", "Real photos carry their exact NASA credit line. Every model says \"Model, not to scale\".", "Voyager 1's light time follows the date, from JPL Horizons."]:
    pa2 = para(doc, 2)
    pa2.paragraph_format.left_indent = Cm(0.5)
    pa2.paragraph_format.first_line_indent = Cm(-0.5)
    run(pa2, "•  ", size=10, bold=True, color=CLAY)
    run(pa2, item, size=10)

heading(doc, "Impact", before=8)
p = para(doc, 4)
run(p, "Players meet the machines as stories, not junk. Real NASA images, data and sounds live in a game people want to finish, and it is ready for classrooms today. Next: play-tests with players and teachers, and more machines.", size=10.5)
p = para(doc, 0, WD_ALIGN_PARAGRAPH.CENTER)
p.paragraph_format.space_before = Pt(6)
run(p, "Left behind. Still answering. Still teaching.", size=15, bold=True, color=CLAY, font=HEAD)

# A second strip of real game screens
more = [
    (crop("laser.jpg", "brief-4.jpg", "crop=1440:810:240:150"), "Send a light to the mirrors"),
    (crop("play.jpg", "brief-5.jpg", "crop=1440:810:240:120"), "Two friends, saying hi with emotes"),
    (crop("notebook.jpg", "brief-6.jpg", "crop=1440:810:240:135"), "Dad's notebook keeps every fact"),
]
p = para(doc, 2)
p.paragraph_format.space_before = Pt(8)
t4 = doc.add_table(rows=1, cols=3)
t4.alignment = WD_TABLE_ALIGNMENT.CENTER
t4.autofit = False
cell_margins(t4, 30, 50, 10, 50)
t4.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
for i, (img, cap) in enumerate(more):
    c = t4.rows[0].cells[i]
    c.width = Cm(6.0)
    c.paragraphs[0].paragraph_format.space_after = Pt(1)
    c.paragraphs[0].add_run().add_picture(str(img), width=Cm(5.8))
    pc = para(c, 0)
    run(pc, cap, size=8.5, italic=True, color=SOFT)
p = para(doc, 0, WD_ALIGN_PARAGRAPH.RIGHT)
run(p, "Real game screens, recorded in Chrome.", size=8, color=SOFT)

doc.save(str(OUT / "PiecesOfHome_Project_Brief.docx"))
print(f"brief: description {words} words, datasets {len(datasets)}, team {len(team)}")
