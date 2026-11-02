#!/usr/bin/env python3
"""Build the static site deployed to GitHub Pages.

Scans demos/ for browser-runnable folders and writes:

- index.html at the repo root (so the landing page is in the tree)
- the same page plus a copy of each demo under _site/

A new demo shows up when this script runs. The Pages workflow runs it on
every push to master, so the published index does not have to be edited
by hand.

Every demo directory must contain index.html. Asset URLs inside a demo
must be relative; root-absolute paths break the project-page URL.
"""

from __future__ import annotations

import html
import re
import shutil
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEMOS = ROOT / "demos"
SITE = ROOT / "_site"
INDEX_NAME = "index.html"

# src="/app.js", href='/styles.css', url("/bg.png"). Skips scheme-relative //.
ROOT_ABSOLUTE = re.compile(
    r"""(?:\b(?:src|href|poster|action)\s*=\s*|url\(\s*)(['"])/(?!/)""",
    re.IGNORECASE,
)
LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
DATE_PREFIX = re.compile(r"^(\d{4}-\d{2}-\d{2})(?:-|$)")
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".svg", ".txt", ".md"}
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def main() -> int:
    if not DEMOS.is_dir():
        print("demos/ is missing. Add a folder per demo, each with index.html.", file=sys.stderr)
        return 1

    demos = list_demos(DEMOS)
    problems = validate(demos)
    if problems:
        for problem in problems:
            print(problem, file=sys.stderr)
        return 1

    lede = readme_lede(ROOT / "README.md") or (
        "Daily, self-contained demos of new AI papers and of conventions for coding agents."
    )
    page = render_index(demos, lede)
    (ROOT / INDEX_NAME).write_text(page, encoding="utf-8")

    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir(parents=True)
    (SITE / INDEX_NAME).write_text(page, encoding="utf-8")
    (SITE / ".nojekyll").write_text("", encoding="utf-8")
    for demo in demos:
        shutil.copytree(
            demo.path,
            SITE / "demos" / demo.name,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"),
        )

    print(f"Wrote {ROOT / INDEX_NAME}")
    print(f"Wrote {SITE} with {len(demos)} demo{'s' if len(demos) != 1 else ''}:")
    for demo in demos:
        print(f"  /demos/{demo.name}/  {demo.title}")
    return 0


class Demo:
    def __init__(self, path: Path, title: str, blurb: str, dated: date | None) -> None:
        self.path = path
        self.name = path.name
        self.title = title
        self.blurb = blurb
        self.dated = dated


def list_demos(demos_dir: Path) -> list[Demo]:
    found: list[Demo] = []
    for path in sorted(demos_dir.iterdir()):
        if not path.is_dir() or path.name.startswith("."):
            continue
        title, blurb = demo_copy(path)
        match = DATE_PREFIX.match(path.name)
        dated = date.fromisoformat(match.group(1)) if match else None
        found.append(Demo(path, title, blurb, dated))
    found.sort(key=lambda demo: (demo.dated is None, -(demo.dated.toordinal() if demo.dated else 0), demo.name))
    return found


def demo_copy(path: Path) -> tuple[str, str]:
    readme = path / "README.md"
    title = ""
    blurb = ""
    if readme.is_file():
        title, blurb = readme_title_and_lede(readme.read_text(encoding="utf-8"))
    if not title:
        slug = DATE_PREFIX.sub("", path.name).replace("-", " ").strip()
        title = slug[:1].upper() + slug[1:] if slug else path.name
    if not blurb:
        blurb = "Open the demo."
    return title, blurb


def readme_lede(path: Path) -> str:
    if not path.is_file():
        return ""
    _title, lede = readme_title_and_lede(path.read_text(encoding="utf-8"))
    return lede


def readme_title_and_lede(text: str) -> tuple[str, str]:
    title = ""
    paragraphs: list[str] = []
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            paragraphs.append(" ".join(buffer))
            buffer.clear()

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            flush()
            if not title:
                title = plain(stripped[2:].strip())
            continue
        if not stripped or stripped.startswith("#"):
            flush()
            continue
        buffer.append(stripped)
    flush()

    lede = ""
    for paragraph in paragraphs:
        if is_nav_line(paragraph):
            continue
        lede = plain(paragraph)
        break
    return title, lede


def is_nav_line(paragraph: str) -> bool:
    return "Live demo" in paragraph and "github.io" in paragraph


def plain(markdown: str) -> str:
    text = LINK.sub(r"\1", markdown)
    text = text.replace("`", "").replace("**", "").replace("__", "")
    text = re.sub(r"(?<!\w)\*(.+?)\*(?!\w)", r"\1", text)
    return " ".join(text.split())


def validate(demos: list[Demo]) -> list[str]:
    problems: list[str] = []
    if not demos:
        problems.append("No demo folders under demos/. Add at least one directory with index.html.")
        return problems
    for demo in demos:
        entry = demo.path / INDEX_NAME
        if not entry.is_file():
            problems.append(
                f"{entry.relative_to(ROOT)} is missing. Every demo must be a static, "
                "browser-runnable folder with index.html. A Python script alone is not "
                "enough; add a page (plain JavaScript, or Pyodide if the demo needs Python)."
            )
            continue
        if entry.stat().st_size == 0:
            problems.append(f"{entry.relative_to(ROOT)} is empty.")
        problems.extend(root_absolute_urls(demo.path))
    return problems


def root_absolute_urls(demo: Path) -> list[str]:
    found: list[str] = []
    for path in demo.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if path.name == "README.md":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for number, line in enumerate(text.splitlines(), start=1):
            if ROOT_ABSOLUTE.search(line):
                found.append(
                    f"{path.relative_to(ROOT)}:{number} uses a root-absolute URL. "
                    "Use a relative path so the demo works at /demos/<folder>/."
                )
    return found


def render_index(demos: list[Demo], lede: str) -> str:
    count = len(demos)
    label = "1 demo" if count == 1 else f"{count} demos"
    cards = "\n".join(card_html(demo) for demo in demos)
    if not cards:
        cards = '<p class="empty">No demos yet.</p>'
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iorek-forges-ai</title>
<meta name="description" content="{html.escape(lede, quote=True)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%231e2a32' width='32' height='32'/%3E%3Cpath d='M6 8h6v16H6zm14 0h6v16h-6z' fill='%23e7c07a'/%3E%3C/svg%3E">
<style>
  :root {{
    --paper: #f3ecdf;
    --card: #fffdf8;
    --ink: #1c1915;
    --muted: #5e574c;
    --line: #e3d7c4;
    --line-strong: #cbbba3;
    --copper: #8d4328;
    --header: #1e2a32;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    background:
      radial-gradient(circle at 12% -10%, rgba(184, 92, 56, 0.08), transparent 42%),
      linear-gradient(180deg, #f7f1e6 0%, var(--paper) 220px);
    color: var(--ink);
    font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 17px;
    line-height: 1.5;
  }}
  h1, h2 {{
    font-family: Palatino, "Palatino Linotype", "Iowan Old Style", Georgia, serif;
    font-weight: 600;
    letter-spacing: -0.02em;
  }}
  a {{ color: inherit; }}
  .wrap {{ max-width: 760px; margin: 0 auto; padding: 48px 20px 72px; }}
  .eyebrow {{
    color: var(--copper);
    font-size: 0.78rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-weight: 700;
    margin: 0 0 8px;
  }}
  h1 {{ font-size: 2.4rem; line-height: 1.05; margin: 0 0 12px; }}
  .lede {{ color: var(--muted); margin: 0 0 28px; max-width: 62ch; }}
  .demos {{ list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }}
  .demos a {{
    display: block;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 16px 18px 18px;
    text-decoration: none;
    box-shadow: 0 1px 0 rgba(28, 25, 21, 0.04);
  }}
  .demos a:hover {{ border-color: var(--line-strong); background: #fffaf3; }}
  .demos a:focus-visible {{ outline: 2px solid var(--header); outline-offset: 3px; }}
  time {{
    display: block;
    color: var(--copper);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }}
  h2 {{ font-size: 1.35rem; margin: 0 0 6px; }}
  .demos p {{ margin: 0; color: var(--muted); }}
  .path {{
    display: block;
    margin-top: 10px;
    color: var(--header);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
  }}
  .empty {{ color: var(--muted); }}
  footer {{
    margin-top: 28px;
    color: var(--muted);
    font-size: 0.92rem;
  }}
  footer a {{ color: var(--copper); }}
  @media (max-width: 640px) {{
    h1 {{ font-size: 1.9rem; }}
    .wrap {{ padding-top: 32px; }}
  }}
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Daily demos · {html.escape(label)}</p>
  <h1>iorek-forges-ai</h1>
  <p class="lede">{html.escape(lede)}</p>
  <ol class="demos">
{cards}
  </ol>
  <footer>
    <p>Each demo is a static folder with <code>index.html</code>. This page is generated from <code>demos/</code> when the site is built, so a new folder is listed on the next push to <code>master</code>.</p>
    <p><a href="https://github.com/MattSheehanDev/iorek-forges-ai">Source on GitHub</a></p>
  </footer>
</div>
</body>
</html>
"""


def card_html(demo: Demo) -> str:
    href = "demos/" + demo.name + "/"
    if demo.dated:
        when = f'<time datetime="{demo.dated.isoformat()}">{demo.dated.day} {MONTHS[demo.dated.month - 1]} {demo.dated.year}</time>'
    else:
        when = "<time>Demo</time>"
    return (
        "    <li>\n"
        f'      <a href="{html.escape(href, quote=True)}">\n'
        f"        {when}\n"
        f"        <h2>{html.escape(demo.title)}</h2>\n"
        f"        <p>{html.escape(demo.blurb)}</p>\n"
        f'        <span class="path">/{html.escape(href)}</span>\n'
        "      </a>\n"
        "    </li>"
    )


if __name__ == "__main__":
    sys.exit(main())
