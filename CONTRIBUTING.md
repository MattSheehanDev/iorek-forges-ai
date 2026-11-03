# Contributing

## Every demo must run in the browser

Every new demo must be a static, browser-runnable folder under `demos/` with an `index.html` entry point.

- Keep the folder self-contained. The site build copies it to `/demos/<folder>/` and serves `index.html` there.
- Use relative asset paths (`style.css`, `./assets/plot.svg`). Root-absolute paths (`/style.css`) leave this project site and will fail the build.
- A Python-only demo is not enough. If the interesting part is Python, ship a browser version in `index.html` (plain JavaScript, or [Pyodide](https://pyodide.org/) when the page needs to run the Python).
- Start `README.md` with a `#` title and a one-paragraph description, and put a Live demo link at the top. The landing page uses that title and paragraph.
- Link the shared theme so the page matches the rest of the site. From a demo folder that is `demos/<name>/`, the stylesheet is two levels up:

```html
<link rel="stylesheet" href="../../assets/theme.css">
```

  Use the tokens in `assets/theme.css` (`--bg`, `--navy`, `--blue`, `--font`) for the page chrome. Do not add a second palette or a copied brand mark.
- Every demo page must include a visible **Inspired by** section near the bottom of `index.html`. Use the shared `.sources` class from `assets/theme.css`. Take the links from that demo's README **Sources** section, including X posts and the key web sources. If the README has no X posts, list just the web sources.

```html
<section class="sources">
  <h2>Inspired by</h2>
  <ul>
    <li><a href="https://example.com/paper">Paper title</a></li>
  </ul>
</section>
```

`scripts/build_site.py` rebuilds the landing page from the `demos/` folders. GitHub Actions runs it and deploys with Pages on every push to `master`, so a new folder is listed without editing `index.html` by hand. The repository's Pages source has to be GitHub Actions.

```bash
python3 scripts/build_site.py
python3 -m http.server --directory _site
```
