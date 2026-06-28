#!/usr/bin/env python3
"""Combine all Atlas documentation markdown into one styled PDF."""
import datetime
import re
from pathlib import Path
from markdown_pdf import MarkdownPdf, Section

# Flatten internal/relative markdown links to plain text (keep external http links).
# markdown-pdf can't resolve cross-doc .md#anchor targets and errors out otherwise.
_LINK = re.compile(r"\[([^\]]+)\]\((?!https?://)[^)]*\)")
def flatten_links(md: str) -> str:
    return _LINK.sub(r"\1", md)

ROOT = Path(__file__).parent

# ── Core documentation (reference docs, in reading order) ──────────────────
CORE = [
    "atlas.md",
    "docs/vision.md",
    "docs/tech-stack.md",
    "docs/architecture.md",
    "docs/domain.md",
    # Database & schema
    "docs/database.md",
    "docs/schema-reference.md",
    # API integrations & booking architecture
    "docs/api-integrations.md",
    "docs/booking-architecture.md",
    # Developer reference
    "docs/server-actions.md",
    "docs/development-guide.md",
    "docs/coding-standards.md",
    "docs/ui-ux.md",
    "docs/business-rules.md",
    "docs/deployment.md",
    "docs/roadmap.md",
    "docs/security.md",
    "docs/analytics.md",
    "docs/ai.md",
]

# ── Project root docs ───────────────────────────────────────────────────────
ROOT_DOCS = [
    "README.md",
    "PROJECT.md",
    "AGENTS.md",
    "DESIGN.md",
    "CLAUDE.md",
]

# ── Audit & review reports ──────────────────────────────────────────────────
AUDITS = [
    "PRODUCTION_READINESS_AUDIT.md",
    "docs/production-audit.md",
    "docs/owner-ux-audit.md",
    "docs/cto-review.md",
]

# ── Architecture decision records ───────────────────────────────────────────
DECISIONS = sorted(
    str(p.relative_to(ROOT))
    for p in ROOT.glob("docs/decisions/*.md")
    if not p.name.startswith("_")
)

# ── Specs ───────────────────────────────────────────────────────────────────
SPECS = sorted(str(p.relative_to(ROOT)) for p in ROOT.glob("specs/**/*.md"))

ORDER = CORE + ROOT_DOCS + AUDITS + DECISIONS + SPECS

# Keep only files that actually exist
ORDER = [f for f in ORDER if (ROOT / f).exists()]

CSS = """
body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
       font-size: 11px; line-height: 1.5; color: #1a1a1a; }
h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 4px; margin-top: 0; }
h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-top: 18px; }
h3 { font-size: 13px; margin-top: 14px; }
h4 { font-size: 12px; margin-top: 10px; }
code { background: #f2f2f2; padding: 1px 4px; border-radius: 3px;
       font-family: 'SF Mono', Menlo, monospace; font-size: 10px; }
pre { background: #f6f8fa; padding: 8px; border-radius: 5px; overflow-x: auto;
      font-size: 9.5px; line-height: 1.35; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10px; }
th, td { border: 1px solid #cfcfcf; padding: 4px 7px; text-align: left; vertical-align: top; }
th { background: #f0f0f0; font-weight: 600; }
blockquote { border-left: 3px solid #bbb; margin: 8px 0; padding: 2px 12px; color: #555; }
a { color: #1a56db; text-decoration: none; }
hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
.section-label { font-size: 9px; color: #999; margin-bottom: 4px; }
"""

pdf = MarkdownPdf(toc_level=2, optimize=True)
pdf.meta["title"] = "Atlas — Complete Documentation"
pdf.meta["author"] = "Atlas"

# Title page
today = datetime.date.today().isoformat()
title_md = (
    "# Atlas — Complete Documentation\n\n"
    "**Multi-tenant SaaS for travel agencies**\n\n"
    f"Generated {today} · {len(ORDER)} documents\n\n"
    "- Live: https://agencetool.vercel.app\n"
    "- Repo: github.com/ouks1993/agence_tool\n\n"
    "## Contents\n\n"
    "**Part 1 — Core Documentation**\n\n" +
    "".join(f"- {f}\n" for f in CORE if (ROOT / f).exists()) +
    "\n**Part 2 — Project Root Docs**\n\n" +
    "".join(f"- {f}\n" for f in ROOT_DOCS if (ROOT / f).exists()) +
    "\n**Part 3 — Audits & Reviews**\n\n" +
    "".join(f"- {f}\n" for f in AUDITS if (ROOT / f).exists()) +
    ("\n**Part 4 — Architecture Decision Records**\n\n" + "".join(f"- {f}\n" for f in DECISIONS if (ROOT / f).exists()) if DECISIONS else "") +
    ("\n**Part 5 — Specs**\n\n" + "".join(f"- {f}\n" for f in SPECS if (ROOT / f).exists()) if SPECS else "")
)
pdf.add_section(Section(title_md, toc=False), user_css=CSS)

for rel in ORDER:
    text = flatten_links((ROOT / rel).read_text(encoding="utf-8"))
    pdf.add_section(Section(text, toc=True, paper_size="A4"), user_css=CSS)

out = ROOT / "Atlas-Documentation.pdf"
pdf.save(str(out))
print(f"WROTE {out} ({out.stat().st_size // 1024} KB, {len(ORDER)} documents)")
