"""NASA data and references (Word) for the local judges, in the brief's paper style.

    python -I video/tools/build-references.py

Writes docs/submission/local/PiecesOfHome_NASA_Data_and_References.docx and a
Markdown copy (references.md) from the project's own records: datasets.md (the
datasets and how the game uses them), src/data/credits.json (every NASA image,
map and sound) and src/data/facts.json (every fact a player can read, with its
source). Facts not marked "checked" are not in the game and are left out.
"""
import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docx_cover import add_cover  # noqa: E402

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

VIDEO = Path(__file__).resolve().parent.parent
ROOT = VIDEO.parent
OUT = ROOT / "docs" / "submission" / "local"
LIVE = "https://piecesofhome.pages.dev"
REPO = "https://github.com/Vurios/piecesofhome"
CHALLENGE = "Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars"
INK = RGBColor(0x2B, 0x26, 0x22)
SOFT = RGBColor(0x62, 0x57, 0x4D)
AMBER = RGBColor(0xB8, 0x66, 0x1C)
HEAD = "Georgia"
BODY = "Calibri"


def clean(s: str) -> str:
    """No em or en dashes in anything we hand out."""
    return re.sub(r"\s*[–—]\s*", ", ", s).replace("�", "e")


# ---------------------------------------------------------------- data
data_md = (OUT / "datasets.md").read_text(encoding="utf-8")
datasets = re.findall(r"^\d+\. (.*)$", data_md.split("## Details")[0], re.M)
assert len(datasets) == 9, datasets
detail_rows = []
for line in data_md.split("## Details")[1].split("## Other")[0].splitlines():
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) == 4 and cells[0] not in ("Resource", "---"):
        detail_rows.append(cells)
others = re.findall(r"^- (.*)$", data_md.split("## Other outside resources (not NASA)")[1], re.M)

credits = json.loads((ROOT / "src/data/credits.json").read_text(encoding="utf-8"))
nasa_media = [m for m in credits["media"] if "CC0" not in m["license"] and "OFL" not in m["license"]]
facts = [f for f in json.loads((ROOT / "src/data/facts.json").read_text(encoding="utf-8"))["facts"] if f["status"] == "checked"]

GROUPS = OrderedDict(
    [
        ("Apollo 11 and the laser mirrors (Moon)", ("a11-", "lrrr-", "a14-", "a15-lrrr", "moon-", "light-roundtrip")),
        ("Apollo 15 and the Moon buggy (Moon)", ("a15-", "lrv-")),
        ("Surveyor 3 and Apollo 12 (Moon)", ("sur3-", "a12-")),
        ("Opportunity rover (Mars)", ("opp-", "mars-blue")),
        ("Ingenuity helicopter (Mars)", ("ing-", "mars-thin")),
        ("Sojourner, Viking 1, Spirit and InSight (Mars)", ("soj-", "vik1-", "spi-", "ins-")),
        ("Voyager 1 and the Golden Record (the finale)", ("v1-", "v2-", "golden-")),
        ("Real recordings", ("rec-",)),
    ]
)
grouped: "OrderedDict[str, list]" = OrderedDict((g, []) for g in GROUPS)
for f in facts:
    for g, prefixes in GROUPS.items():
        if f["id"].startswith(prefixes):
            grouped[g].append(f)
            break
    else:
        raise SystemExit(f"no group for fact {f['id']}")
assert sum(len(v) for v in grouped.values()) == len(facts)


def claim(f) -> str:
    return clean(f.get("kid") or f.get("short") or f.get("value") or "")


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
        e.set(qn("w:val"), "single")
        e.set(qn("w:sz"), str(size))
        e.set(qn("w:color"), color)
        b.append(e)
    tbl.append(b)


def repeat_header(row) -> None:
    trpr = row._tr.get_or_add_trPr()
    h = OxmlElement("w:tblHeader")
    h.set(qn("w:val"), "true")
    trpr.append(h)


def run(p, text, size=10, bold=False, italic=False, color=INK, font=BODY):
    r = p.add_run(clean(text))
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    r.font.name = font
    r._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    return r


def link(p, url, text=None, size=9):
    rid = p.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
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
    t.text = clean(text or url)
    t.set(qn("xml:space"), "preserve")
    r.append(t)
    h.append(r)
    p._p.append(h)


def para(container, after=3, align=None):
    p = container.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(0)
    pf.space_after = Pt(after)
    pf.line_spacing = 1.08
    if align is not None:
        p.alignment = align
    return p


def heading(text, size=14, before=10, after=3):
    p = para(doc, after)
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.keep_with_next = True
    run(p, text, size=size, bold=True, color=AMBER, font=HEAD)
    return p


def table(headers, widths_cm, rows, size=8.5):
    """rows: lists of cells; a cell is text, or (text, url) for a link, or a list of those."""
    t = doc.add_table(rows=1, cols=len(headers))
    t.autofit = False
    borders(t)
    for i, w in enumerate(widths_cm):
        t.columns[i].width = Cm(w)
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.width = Cm(widths_cm[i])
        shade(c, "F3E6CC")
        p = c.paragraphs[0]
        run(p, h, size=size, bold=True, font=BODY)
    repeat_header(t.rows[0])
    for k, row in enumerate(rows):
        cells = t.add_row().cells
        for i, val in enumerate(row):
            c = cells[i]
            c.width = Cm(widths_cm[i])
            if k % 2:
                shade(c, "FBF6EC")
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            for part in val if isinstance(val, list) else [val]:
                if isinstance(part, tuple):
                    link(p, part[1], part[0], size=size)
                else:
                    run(p, part, size=size, color=INK if i else INK)
    para(doc, 2)
    return t


# ---------------------------------------------------------------- document
doc = Document()
sec = add_cover(doc, ROOT / "docs/submission/cover/cover-references.jpg")
st = doc.styles["Normal"]
st.font.name = BODY
st.font.size = Pt(10)
doc.core_properties.title = "Pieces of Home: NASA data and references"
doc.core_properties.author = "Hackstreet Boys"
doc.core_properties.comments = "Made with AI tools; see AI_USE.md in github.com/Vurios/piecesofhome."

fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
run(fp, "NASA did not make, sponsor or endorse this project. No NASA insignia, logotype or seal is used. NASA images carry their credits.", size=8, color=SOFT)

p = para(doc, 0)
run(p, "Pieces of Home", size=26, bold=True, font=HEAD)
p = para(doc, 2)
run(p, "NASA data and references", size=16, bold=True, color=AMBER, font=HEAD)
p = para(doc, 2)
run(p, "Team Hackstreet Boys. Challenge: ", size=10, color=SOFT)
run(p, CHALLENGE, size=10, italic=True, color=SOFT)
p = para(doc, 8)
run(p, "Play: ", size=10, color=SOFT)
link(p, LIVE, size=10)
run(p, "    Code: ", size=10, color=SOFT)
link(p, REPO, size=10)

p = para(doc, 4)
run(
    p,
    f"Pieces of Home is a cozy browser game about the machines people left on the Moon and Mars. This document lists every NASA "
    f"dataset, image, map and sound the game uses, and the source of every fact a player can read ({len(facts)} facts). "
    "Every number, date and claim in the game comes from one file, src/data/facts.json, and every fact there has a source link. "
    "Every link below opens without a login. We checked them on November 15, 2026: all returned HTTP 200, except JPL news pages, "
    "which refuse scripted requests but open normally in a browser. Dad's models of landing sites are labeled \"Model, not to scale\", "
    "and every real photo shows its exact credit line.",
)

heading("1. NASA datasets used")
for i, d in enumerate(datasets, 1):
    p = para(doc, 2)
    p.paragraph_format.left_indent = Cm(0.5)
    p.paragraph_format.first_line_indent = Cm(-0.5)
    run(p, f"{i}. ", bold=True, color=AMBER)
    run(p, d)

heading("2. How the game uses each resource")
rows = []
for res, src, url, use in detail_rows:
    urls = re.findall(r"https?://[^\s,)]+", url)
    link_cell = [(u, u) for u in urls] if urls else [clean(url)]
    if len(link_cell) > 1:
        link_cell = sum(([c, "  "] for c in link_cell), [])[:-1]
    rows.append([[res + "\n", src], use, link_cell])
table(["Resource and source", "How the game uses it", "Link"], [4.4, 8.6, 5.0], rows)

heading("3. NASA images, maps and sounds in the game")
p = para(doc, 4)
run(p, "Each one is shown or played with its credit line. None is changed except where noted (resized, cropped, or made quieter).", size=9.5, color=SOFT)
rows = []
for m in nasa_media:
    what = clean(m["title"])
    rows.append([what, clean(m["credit"]), clean(m["license"]), [("Page", m.get("page") or m["sourceUrl"]), "  ", ("File", m["sourceUrl"])]])
table(["What", "Credit line", "License", "Source"], [6.2, 4.4, 4.6, 2.8], rows)

heading("4. Live data")
rows = [[clean(d["name"]), clean(d["by"]), clean(d["use"]), [(d["sourceUrl"], d["sourceUrl"])]] for d in credits["data"]]
table(["Data", "From", "How the game uses it", "Link"], [4.2, 4.0, 5.6, 4.2], rows)

heading("5. Every fact in the game and its source")
p = para(doc, 4)
run(
    p,
    "The left column is the fact's ID in src/data/facts.json. The middle column is how the game says it to a young player. "
    "The right column is the page the fact was checked against.",
    size=9.5,
    color=SOFT,
)
for g, fs in grouped.items():
    if not fs:
        continue
    heading(g, size=11.5, before=8, after=2)
    rows = [[f["id"], claim(f), [(clean(f["sourceTitle"]), f["sourceUrl"])]] for f in fs]
    table(["Fact ID", "What the game says", "Source"], [3.0, 8.2, 6.8], rows, size=8)

heading("6. Other resources (not NASA)")
for o in others:
    p = para(doc, 2)
    p.paragraph_format.left_indent = Cm(0.5)
    run(p, "•  " + o, size=9.5)

p = para(doc, 0)
p.paragraph_format.space_before = Pt(10)
run(
    p,
    "NASA is credited as a source. NASA did not make, sponsor or endorse this project. The full list of every file in the game, "
    "with its license, is in CREDITS.md in our repository.",
    size=9,
    italic=True,
    color=SOFT,
)

dst = OUT / "PiecesOfHome_NASA_Data_and_References.docx"
doc.save(dst)

# ---------------------------------------------------------------- Markdown copy
md = [
    "# Pieces of Home: NASA data and references",
    "",
    f"Team Hackstreet Boys. Challenge: {CHALLENGE}. Play: {LIVE}. Code: {REPO}.",
    "",
    f"Every NASA dataset, image, map and sound the game uses, and the source of every fact a player can read ({len(facts)} facts). Links checked November 15, 2026.",
    "",
    "## 1. NASA datasets used",
    "",
    *[f"{i}. {d}" for i, d in enumerate(datasets, 1)],
    "",
    "## 2. NASA images, maps and sounds in the game",
    "",
    "| What | Credit line | License | Source |",
    "|---|---|---|---|",
    *[f"| {clean(m['title'])} | {clean(m['credit'])} | {clean(m['license'])} | {m.get('page') or m['sourceUrl']} |" for m in nasa_media],
    "",
    "## 3. Every fact in the game and its source",
    "",
]
for g, fs in grouped.items():
    md += [f"### {g}", "", "| Fact ID | What the game says | Source |", "|---|---|---|"]
    md += [f"| {f['id']} | {claim(f)} | [{clean(f['sourceTitle'])}]({f['sourceUrl']}) |" for f in fs]
    md.append("")
md += ["NASA is credited as a source. NASA did not make, sponsor or endorse this project.", ""]
text = "\n".join(md)
assert not re.search("[–—]", text)
(OUT / "references.md").write_text(text, encoding="utf-8")
print(dst, f"{len(datasets)} datasets, {len(nasa_media)} NASA media, {len(facts)} facts")
