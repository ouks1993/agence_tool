#!/usr/bin/env python3
"""
Build the Atlas documentation PDF — a professionally typeset, branded report.

Pipeline:
  1. Render each markdown document into its own page range with markdown_pdf
     (PyMuPDF Story engine) using a refined print stylesheet.
  2. Re-assemble with fitz into a final document that adds:
       - a drawn brand cover page
       - a real Table of Contents (human-readable titles, dot leaders, page nos.)
       - drawn part-divider pages
       - running headers + footer page numbers on content pages
       - a clean Part -> Document bookmark outline + PDF metadata
"""
import datetime
import re
from pathlib import Path

import fitz  # PyMuPDF
from markdown_pdf import MarkdownPdf, Section

ROOT = Path(__file__).parent
OUT = ROOT / "Atlas-Documentation.pdf"

# ──────────────────────────────────────────────────────────────────────────
# Brand system
# ──────────────────────────────────────────────────────────────────────────
INK      = (0.105, 0.135, 0.225)   # #1B2239 deep navy — headings, cover band
INK_SOFT = (0.20, 0.24, 0.34)      # secondary ink
ACCENT   = (0.231, 0.357, 0.604)   # #3B5B9A indigo-blue — rules, links
AMBER    = (0.706, 0.325, 0.075)   # #B45313 warm accent — wordmark, part nos.
MUTED    = (0.353, 0.392, 0.471)   # #5A6478 captions / leaders
HAIRLINE = (0.867, 0.886, 0.918)   # #DDE2EA thin rules
PANEL    = (0.957, 0.965, 0.980)   # #F4F6FA divider/panel fill
WHITE    = (1, 1, 1)

# A4 geometry (points)
PW, PH = fitz.paper_size("A4")          # 595.276 x 841.890
ML, MR, MT, MB = 58, 58, 70, 60         # content margins
CONTENT_W = PW - ML - MR

FONT_REG = "helv"
FONT_BOLD = "hebo"
FONT_OBL = "heit"
FONT_MONO = "cour"

GENERATED = datetime.date.today().isoformat()

# ──────────────────────────────────────────────────────────────────────────
# Document set (grouped into parts, in reading order)
# ──────────────────────────────────────────────────────────────────────────
CORE = [
    "atlas.md", "docs/vision.md", "docs/tech-stack.md", "docs/architecture.md",
    "docs/domain.md", "docs/database.md", "docs/schema-reference.md",
    "docs/api-integrations.md", "docs/booking-architecture.md",
    "docs/server-actions.md", "docs/development-guide.md",
    "docs/coding-standards.md", "docs/ui-ux.md", "docs/business-rules.md",
    "docs/deployment.md", "docs/roadmap.md", "docs/security.md",
    "docs/analytics.md", "docs/ai.md",
]
ROOT_DOCS = ["README.md", "PROJECT.md", "AGENTS.md", "DESIGN.md", "CLAUDE.md"]
AUDITS = [
    "PRODUCTION_READINESS_AUDIT.md", "docs/production-audit.md",
    "docs/owner-ux-audit.md", "docs/cto-review.md",
]
DECISIONS = sorted(
    str(p.relative_to(ROOT))
    for p in ROOT.glob("docs/decisions/*.md")
    if not p.name.startswith("_")
)
SPECS = sorted(str(p.relative_to(ROOT)) for p in ROOT.glob("specs/**/*.md"))

PARTS = [
    ("I",   "Core Documentation",            CORE),
    ("II",  "Project Root Docs",             ROOT_DOCS),
    ("III", "Audits & Reviews",              AUDITS),
    ("IV",  "Architecture Decision Records", DECISIONS),
    ("V",   "Specifications",                SPECS),
]

# Human-readable title overrides (where the first H1 is generic/missing)
TITLE_OVERRIDES = {
    "README.md": "Project README",
    "AGENTS.md": "Agent & Coding Conventions",
    "CLAUDE.md": "Claude Code Instructions",
    "PROJECT.md": "Project Overview",
    "atlas.md": "Atlas — Documentation Index",
}

# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────
_LINK = re.compile(r"\[([^\]]+)\]\((?!https?://)[^)]*\)")


def flatten_links(md: str) -> str:
    """Drop internal/relative md links (Story can't resolve cross-doc anchors)."""
    return _LINK.sub(r"\1", md)


def doc_title(rel: str) -> str:
    """Human-readable title: override → first H1 → prettified filename."""
    if rel in TITLE_OVERRIDES:
        return TITLE_OVERRIDES[rel]
    text = (ROOT / rel).read_text(encoding="utf-8")
    m = re.search(r"^#\s+(.+?)\s*$", text, re.M)
    if m:
        return m.group(1).strip()
    stem = Path(rel).stem.replace("-", " ").replace("_", " ")
    return stem.title()


def tw(text: str, font: str, size: float) -> float:
    """Width of a single text line in points."""
    return fitz.get_text_length(text, fontname=font, fontsize=size)


def shrink(text: str, font: str, size: float, max_w: float) -> str:
    """Truncate with an ellipsis so text fits within max_w."""
    if tw(text, font, size) <= max_w:
        return text
    ell = "…"
    while text and tw(text + ell, font, size) > max_w:
        text = text[:-1]
    return text + ell


# Print stylesheet for the document bodies (PyMuPDF Story CSS subset).
CSS = """
* { font-family: sans-serif; }
body { font-size: 10.5px; line-height: 1.55; color: #25292f; }

h1 { font-size: 21px; font-weight: bold; color: #1B2239;
     margin: 0 0 4px 0; padding: 0 0 6px 0; border-bottom: 2px solid #3B5B9A; }
h2 { font-size: 15px; font-weight: bold; color: #1B2239;
     margin: 20px 0 6px 0; padding-bottom: 3px; border-bottom: 1px solid #DDE2EA; }
h3 { font-size: 12.5px; font-weight: bold; color: #2B3550; margin: 15px 0 4px 0; }
h4 { font-size: 11px; font-weight: bold; color: #3B5B9A; margin: 12px 0 3px 0; }

p  { margin: 0 0 8px 0; }
ul, ol { margin: 0 0 8px 0; padding-left: 18px; }
li { margin: 2px 0; line-height: 1.5; }

a { color: #3B5B9A; text-decoration: none; }

strong { color: #1B2239; }
em { color: #3B3F49; }

code { font-family: monospace; font-size: 9px; color: #1d3a63;
       background-color: #eef1f7; padding: 1px 3px; }
pre { font-family: monospace; font-size: 8.6px; line-height: 1.4; color: #2d3344;
      background-color: #f4f6fa; border: 1px solid #e2e7f0;
      padding: 8px 10px; margin: 0 0 9px 0; white-space: pre-wrap; }
pre code { background-color: transparent; padding: 0; color: #2d3344; }

table { border-collapse: collapse; width: 100%; margin: 8px 0 12px 0;
        font-size: 9px; }
th { color: #1B2239; font-weight: bold; text-align: left; padding: 5px 8px;
     border-top: 1px solid #1B2239; border-bottom: 2px solid #1B2239; }
td { padding: 5px 8px; border-bottom: 1px solid #DDE2EA; vertical-align: top; }

blockquote { border-left: 3px solid #3B5B9A;
             margin: 8px 0; padding: 4px 14px; color: #4a5160; }
hr { border: none; border-top: 1px solid #DDE2EA; margin: 14px 0; }
"""


# ──────────────────────────────────────────────────────────────────────────
# Stage 1 — render document bodies, capture per-doc page ranges
# ──────────────────────────────────────────────────────────────────────────
def render_bodies():
    """Return (body_pdf_bytes, entries) where entries describe each part/doc."""
    pdf = MarkdownPdf(toc_level=0, optimize=True)
    pdf.meta["title"] = "Atlas — Complete Documentation"
    pdf.meta["author"] = "Atlas"

    entries = []  # list of {part_roman, part_title, docs:[{rel,title,start0,count}]}
    page_cursor = 0
    for roman, ptitle, files in PARTS:
        files = [f for f in files if (ROOT / f).exists()]
        if not files:
            continue
        docs = []
        for rel in files:
            md = flatten_links((ROOT / rel).read_text(encoding="utf-8"))
            before = pdf.page_num
            pdf.add_section(Section(md, toc=False, paper_size="A4",
                                    borders=(ML, MT, -MR, -MB)),
                            user_css=CSS)
            count = pdf.page_num - before
            docs.append({"rel": rel, "title": doc_title(rel),
                         "start0": page_cursor, "count": count})
            page_cursor += count
        entries.append({"roman": roman, "title": ptitle, "docs": docs})

    tmp = ROOT / ".docs-body.tmp.pdf"
    pdf.save(tmp)                       # optimize=True → compressed (ez_save)
    data = tmp.read_bytes()
    tmp.unlink()
    return data, entries


# ──────────────────────────────────────────────────────────────────────────
# Stage 2 — drawn front matter + chrome
# ──────────────────────────────────────────────────────────────────────────
def draw_compass(page, cx, cy, r, color, lw=1.4):
    """A small compass / Atlas mark: ring + 4-point star."""
    page.draw_circle((cx, cy), r, color=color, width=lw)
    s = r * 0.72            # star tip reach
    w = r * 0.20            # star waist
    pts = [(cx, cy - s), (cx + w, cy - w), (cx + s, cy),
           (cx + w, cy + w), (cx, cy + s), (cx - w, cy + w),
           (cx - s, cy), (cx - w, cy - w)]
    page.draw_polyline(pts + [pts[0]], color=color, fill=color, width=0.6)


def draw_cover(doc, n_docs):
    page = doc.new_page(width=PW, height=PH)
    band_h = PH * 0.46
    # Ink band
    page.draw_rect(fitz.Rect(0, 0, PW, band_h), color=INK, fill=INK)
    # Amber hairline at band foot
    page.draw_line((0, band_h), (PW, band_h), color=AMBER, width=2.4)

    # Wordmark
    draw_compass(page, ML + 13, 92, 13, WHITE, lw=1.4)
    page.insert_text((ML + 34, 97), "ATLAS", fontname=FONT_BOLD, fontsize=16,
                     color=WHITE)
    page.insert_text((ML + 34 + tw("ATLAS", FONT_BOLD, 16) + 8, 97),
                     "TRAVEL DESK", fontname=FONT_REG, fontsize=9,
                     color=(0.74, 0.79, 0.88))

    # Title
    page.insert_text((ML, 232), "Complete", fontname=FONT_BOLD, fontsize=40,
                     color=WHITE)
    page.insert_text((ML, 282), "Documentation", fontname=FONT_BOLD, fontsize=40,
                     color=WHITE)
    page.insert_text((ML, 320), "Multi-tenant SaaS for travel agencies",
                     fontname=FONT_REG, fontsize=13, color=(0.78, 0.83, 0.91))

    # Lower metadata block
    y = band_h + 54
    page.insert_text((ML, y), "TECHNICAL REFERENCE", fontname=FONT_BOLD,
                     fontsize=10, color=AMBER)
    y += 30
    rows = [
        ("Generated", GENERATED),
        ("Documents", f"{n_docs} documents across {len([p for p in PARTS if any((ROOT/f).exists() for f in p[2])])} parts"),
        ("Live", "https://agencetool.vercel.app"),
        ("Repository", "github.com/ouks1993/agence_tool"),
    ]
    for label, val in rows:
        page.insert_text((ML, y), label.upper(), fontname=FONT_BOLD,
                         fontsize=8.5, color=MUTED)
        page.insert_text((ML + 96, y), val, fontname=FONT_REG, fontsize=10.5,
                         color=INK_SOFT)
        y += 22

    # Footer rule + note
    fy = PH - 64
    page.draw_line((ML, fy), (PW - MR, fy), color=HAIRLINE, width=0.8)
    page.insert_text((ML, fy + 16), "Internal documentation — generated artifact.",
                     fontname=FONT_OBL, fontsize=8.5, color=MUTED)
    page.insert_text((PW - MR - tw("Atlas", FONT_BOLD, 9), fy + 16), "Atlas",
                     fontname=FONT_BOLD, fontsize=9, color=INK)


def toc_rows(entries):
    """Flatten parts + docs into renderable rows with final page numbers."""
    return entries  # page numbers computed in layout once k is known


def layout_toc(doc, entries, k, page_map, draw, links=None):
    """
    Lay out the Contents. Returns number of pages used.
    If draw is False, only counts pages (page_map ignored).
    page_map[rel] -> printed page number. When drawing, appends
    (page, rect, rel) tuples to `links` for later clickable-TOC wiring.
    """
    line_h = 19.0
    part_gap = 16.0
    top_y = MT + 46            # below the "Contents" title on page 1
    bottom = PH - MB - 6

    pages_used = 0
    page = None
    y = 0

    def new_toc_page(first):
        nonlocal page, y, pages_used
        pages_used += 1
        if draw:
            page = doc.new_page(width=PW, height=PH)
            if first:
                page.insert_text((ML, MT + 8), "Contents", fontname=FONT_BOLD,
                                 fontsize=22, color=INK)
                page.draw_line((ML, MT + 20), (PW - MR, MT + 20),
                               color=ACCENT, width=1.6)
                y = top_y
            else:
                y = MT + 6
        else:
            y = top_y if first else MT + 6

    new_toc_page(True)

    for ent in entries:
        # room for part header + at least one doc?
        if y + part_gap + line_h * 2 > bottom:
            new_toc_page(False)
        # Part header
        if draw:
            page.insert_text((ML, y), f"PART {ent['roman']}", fontname=FONT_BOLD,
                             fontsize=9, color=AMBER)
            page.insert_text((ML + tw(f"PART {ent['roman']}", FONT_BOLD, 9) + 10, y),
                             ent["title"].upper(), fontname=FONT_BOLD, fontsize=9,
                             color=INK)
        y += line_h + 2

        for d in ent["docs"]:
            if y + line_h > bottom:
                new_toc_page(False)
            num = str(page_map.get(d["rel"], "")) if draw else ""
            if draw:
                title = shrink(d["title"], FONT_REG, 10.5, CONTENT_W - 60)
                tx = ML + 14
                page.insert_text((tx, y), title, fontname=FONT_REG,
                                 fontsize=10.5, color=INK_SOFT)
                t_end = tx + tw(title, FONT_REG, 10.5)
                nx = PW - MR - tw(num, FONT_REG, 10.5)
                page.insert_text((nx, y), num, fontname=FONT_REG, fontsize=10.5,
                                 color=INK_SOFT)
                # dotted leader
                lx0, lx1 = t_end + 6, nx - 6
                if lx1 > lx0:
                    page.draw_line((lx0, y - 2.5), (lx1, y - 2.5), color=HAIRLINE,
                                   width=0.8, dashes="[0.6 2.6] 0")
                if links is not None:
                    links.append((page.number,
                                  fitz.Rect(ML, y - 13, PW - MR, y + 4),
                                  d["rel"]))
            y += line_h

        y += part_gap

    return pages_used


def draw_part_divider(doc, roman, title, n_docs):
    page = doc.new_page(width=PW, height=PH)
    page.draw_rect(fitz.Rect(0, 0, PW, PH), color=PANEL, fill=PANEL)
    cy = PH * 0.40
    page.insert_text((ML, cy - 26), f"PART {roman}", fontname=FONT_BOLD,
                     fontsize=13, color=AMBER)
    # big title (wrap to two lines if needed)
    page.insert_textbox(fitz.Rect(ML, cy, PW - MR, cy + 90), title,
                        fontname=FONT_BOLD, fontsize=30, color=INK, align=0)
    page.draw_line((ML, cy + 100), (ML + 90, cy + 100), color=ACCENT, width=2.4)
    page.insert_text((ML, cy + 122),
                     f"{n_docs} document{'s' if n_docs != 1 else ''}",
                     fontname=FONT_REG, fontsize=11, color=MUTED)
    # bottom wordmark
    draw_compass(page, ML + 8, PH - MB, 8, INK, lw=1.1)
    page.insert_text((ML + 22, PH - MB + 4), "ATLAS", fontname=FONT_BOLD,
                     fontsize=10, color=INK)
    return page


def add_chrome(page, doc_title_str, page_no):
    """Running header + footer page number on a content page."""
    # Header
    hy = MT - 30
    page.insert_text((ML, hy), shrink(doc_title_str.upper(), FONT_BOLD, 8,
                                      CONTENT_W * 0.7),
                     fontname=FONT_BOLD, fontsize=8, color=MUTED)
    rt = "ATLAS DOCUMENTATION"
    page.insert_text((PW - MR - tw(rt, FONT_REG, 8), hy), rt,
                     fontname=FONT_REG, fontsize=8, color=MUTED)
    page.draw_line((ML, hy + 6), (PW - MR, hy + 6), color=HAIRLINE, width=0.6)
    # Footer
    fy = PH - MB + 24
    page.draw_line((ML, fy - 12), (PW - MR, fy - 12), color=HAIRLINE, width=0.6)
    num = str(page_no)
    page.insert_text(((PW - tw(num, FONT_BOLD, 9)) / 2, fy), num,
                     fontname=FONT_BOLD, fontsize=9, color=INK_SOFT)
    page.insert_text((ML, fy), "Atlas — Complete Documentation",
                     fontname=FONT_REG, fontsize=8, color=MUTED)


# ──────────────────────────────────────────────────────────────────────────
# Assemble
# ──────────────────────────────────────────────────────────────────────────
def build():
    body_bytes, entries = render_bodies()
    body = fitz.open("pdf", body_bytes)
    n_docs = sum(len(e["docs"]) for e in entries)

    # Compute TOC page count (k) via a measuring pass.
    final = fitz.open()
    k = layout_toc(None, entries, 0, {}, draw=False)

    # Content page numbers (1-based) start at the first divider page.
    # Order on final doc: [cover][toc x k][ for each part: divider + its docs ].
    # Page numbers cover only document pages (cover, TOC and dividers are
    # outside the sequence), so the first real page reads "1".
    page_map = {}                       # rel -> printed page number (1-based)
    cursor_content = 1
    for ent in entries:
        for d in ent["docs"]:
            page_map[d["rel"]] = cursor_content
            cursor_content += d["count"]

    # 1) cover
    draw_cover(final, n_docs)
    # 2) toc
    toc_links = []
    drawn_k = layout_toc(final, entries, k, page_map, draw=True, links=toc_links)
    assert drawn_k == k, f"TOC page count mismatch: planned {k}, drew {drawn_k}"

    # 3) parts: divider + sliced body pages, with running headers/footers
    content_no = 1
    toc_outline = []   # (level, title, 1-based page)
    abs0_for = {}      # rel -> 0-based index of the doc's first page in final
    for ent in entries:
        draw_part_divider(final, ent["roman"], ent["title"], len(ent["docs"]))
        div_abs1 = final.page_count          # 1-based index of the divider
        toc_outline.append((1, f"Part {ent['roman']} — {ent['title']}", div_abs1))
        for d in ent["docs"]:
            insert_at = final.page_count
            final.insert_pdf(body, from_page=d["start0"],
                             to_page=d["start0"] + d["count"] - 1)
            abs0_for[d["rel"]] = insert_at
            toc_outline.append((2, d["title"], insert_at + 1))
            for i in range(d["count"]):
                add_chrome(final[insert_at + i], d["title"], content_no)
                content_no += 1

    # Clickable TOC: link each row to its document's first page.
    for pno, rect, rel in toc_links:
        if rel in abs0_for:
            final[pno].insert_link({"kind": fitz.LINK_GOTO, "from": rect,
                                    "page": abs0_for[rel], "to": fitz.Point(0, 0)})

    # Metadata + outline
    final.set_metadata({
        "title": "Atlas — Complete Documentation",
        "author": "Atlas",
        "subject": "Multi-tenant SaaS for travel agencies — technical reference",
        "keywords": "Atlas, documentation, travel, SaaS",
        "creator": "Atlas docs build",
    })
    final.set_toc([[lvl, title, pg] for lvl, title, pg in
                   [(1, "Cover", 1), (1, "Contents", 2)] + toc_outline])

    final.save(OUT, garbage=4, deflate=True, deflate_images=True,
               deflate_fonts=True, clean=True)
    body.close()
    final.close()
    size_kb = OUT.stat().st_size // 1024
    print(f"WROTE {OUT} ({size_kb} KB, {n_docs} documents, "
          f"{1 + k} front-matter pages)")


if __name__ == "__main__":
    build()
