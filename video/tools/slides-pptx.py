"""PowerPoint copy of the slides, with speaker notes.

    python -I video/tools/slides-pptx.py

Each slide is the full-bleed image made by build-slides.ts, so it looks the same
as the PDF; the speaker notes are real notes, visible in presenter view.
"""
import json
from pathlib import Path

from pptx import Presentation
from pptx.util import Emu

VIDEO = Path(__file__).resolve().parent.parent
ROOT = VIDEO.parent
OUT = ROOT / "docs" / "submission" / "local"
notes = json.loads((OUT / "slides" / "notes.json").read_text(encoding="utf-8"))
prs = Presentation()
prs.slide_width = Emu(12192000)  # 13.333 in, 16:9
prs.slide_height = Emu(6858000)
blank = prs.slide_layouts[6]
for i, note in enumerate(notes, start=1):
    slide = prs.slides.add_slide(blank)
    slide.shapes.add_picture(str(VIDEO / "out" / "slides" / f"slide-{i:02d}.jpg"), 0, 0, width=prs.slide_width, height=prs.slide_height)
    slide.notes_slide.notes_text_frame.text = note
prs.core_properties.title = "Pieces of Home"
prs.core_properties.author = "Hackstreet Boys"
prs.core_properties.comments = "Made with AI tools; see AI_USE.md in github.com/Vurios/piecesofhome."
prs.save(str(OUT / "PiecesOfHome_Slides.pptx"))
print("slides:", len(notes))
