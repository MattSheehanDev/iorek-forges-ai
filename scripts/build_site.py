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
    (SITE / "CNAME").write_text("iorek.mattsheehan.dev\n", encoding="utf-8")
    assets = ROOT / "assets"
    if assets.is_dir():
        shutil.copytree(assets, SITE / "assets")
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
    return "Live demo" in paragraph and ("github.io" in paragraph or "mattsheehan.dev" in paragraph)


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
<title>Iorek Forges</title>
<meta name="description" content="{html.escape(lede, quote=True)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%233b6a8f' width='32' height='32' rx='6'/%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/theme.css">
</head>
<body>
<header class="site-header">
  <div class="site-bar">
    <div class="site-bar-inner">
      <a class="site-name" href="./">Iorek Forges</a>
      <div class="site-bar-right">
        <span class="site-count">{html.escape(label)}</span>
        <nav class="site-nav" aria-label="Site">
          <a href="https://github.com/MattSheehanDev/iorek-forges-ai">Source</a>
        </nav>
      </div>
    </div>
  </div>
</header>
<section class="hero">
  <div class="kicker">Something new most mornings</div>
  <h1>Small experiments with AI</h1>
  <p class="lede">Each morning I pick one idea from the AI world, a new paper or a habit dev teams are picking up, and build a little page you can play with. Nothing to install. Just open one and click around.</p>
</section>
<main class="page">
  <ol class="demo-list">
{cards}
  </ol>
</main>
<footer class="site-footer">
  <div class="site-footer-inner">
    <p>Made by Matthew Sheehan. Everything here runs right in your browser, so there's nothing to install.</p>
    <p><a href="https://github.com/MattSheehanDev/iorek-forges-ai">Source on GitHub</a></p>
  </div>
</footer>
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
        f'      <a class="demo-card" href="{html.escape(href, quote=True)}">\n'
        f"        {when}\n"
        f"        <h2>{html.escape(demo.title)}</h2>\n"
        f"        <p>{html.escape(demo.blurb)}</p>\n"
        f'        <span class="demo-card-path">Open demo →</span>\n'
        "      </a>\n"
        "    </li>"
    )


if __name__ == "__main__":
    sys.exit(main())
