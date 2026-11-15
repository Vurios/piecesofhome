"""Puts the title page (made by build-cover.ts) on page one of a Word document.

The cover is its own section with no margins and no footer; the document's own
section, with normal margins, starts on page two.
"""
from pathlib import Path

from docx.enum.section import WD_SECTION
from docx.shared import Cm, Pt


def add_cover(doc, png: Path, left=Cm(1.5), right=Cm(1.5), top=Cm(1.3), bottom=Cm(1.2)):
    """Call on a new Document before adding anything else. Returns the body section."""
    cover = doc.sections[0]
    cover.page_width, cover.page_height = Cm(21.0), Cm(29.7)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(cover, side, Cm(0))
    cover.header_distance = cover.footer_distance = Cm(0)
    p = doc.paragraphs[0] if doc.paragraphs else doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = pf.space_after = Pt(0)
    pf.line_spacing = 1.0
    p.add_run().add_picture(str(png), width=Cm(20.98), height=Cm(29.66))
    body = doc.add_section(WD_SECTION.NEW_PAGE)
    body.page_width, body.page_height = Cm(21.0), Cm(29.7)
    body.left_margin, body.right_margin, body.top_margin, body.bottom_margin = left, right, top, bottom
    body.header_distance, body.footer_distance = Cm(0.8), Cm(0.6)
    body.footer.is_linked_to_previous = False
    body.header.is_linked_to_previous = False
    return body
