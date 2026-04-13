# How This Project Works — Tech & Changes for GitHub Pages

## Overview

This is a **JupyterBook v2 (MyST)** template with **interactive Pyodide code cells** that run Python entirely in the browser via WebAssembly. No server is required — all code execution happens client-side on GitHub Pages.

**Live site:** <https://chandraveshchaudhari.github.io/jupyterbook2_with_lite_template/>

---

## Tech Stack

| Technology | Version | Role |
|---|---|---|
| **[Jupyter Book v2](https://jupyterbook.org)** | 2.1.4 | Static site generator (wraps MyST) |
| **[MyST (Markedly Structured Text)](https://mystmd.org)** | 1.8.x | Markdown parser, plugin system, builds HTML |
| **[Remix / React](https://remix.run)** | (bundled in book-theme) | Server-side rendering (SSR) + client-side hydration |
| **[Tailwind CSS](https://tailwindcss.com)** | (bundled in book-theme) | Utility-first CSS framework for styling |
| **[Pyodide](https://pyodide.org)** | 0.27.4 (CDN) | CPython → WebAssembly, runs Python in the browser |
| **[CodeMirror 5](https://codemirror.net/5)** | 5.65.18 | Syntax-highlighted code editor in the browser |
| **GitHub Pages** | — | Static file hosting (deployed via GitHub Actions) |
| **GitHub Actions** | — | CI/CD pipeline for build + deploy |

### Pre-installed Python packages (in Pyodide)
- `numpy`, `pandas`, `matplotlib` — loaded on first code execution

---

## Architecture

```
myst.yml                   ← Project config, TOC, plugins, site options
├── plugins/
│   └── pyodide-block.mjs  ← MyST directive plugin (defines :::{pyodide-cell})
├── _static/
│   ├── pyodide-runner.js  ← Pyodide singleton: load(), execute(), restart()
│   ├── pyodide-transform.js ← DOM transformer: cells → CodeMirror editors + rocket toolbar
│   ├── pyodide.css        ← All cell + rocket toolbar styles (light + dark mode)
│   └── codemirror/
│       ├── codemirror.js  ← CodeMirror 5 core (minified, 170KB)
│       ├── python.js      ← CodeMirror 5 Python syntax mode
│       └── codemirror.css ← CodeMirror 5 base styles
├── patch_theme.py         ← Build script: copies _static/ into theme, patches index.js
├── notebooks/             ← Content pages (.ipynb and .md with pyodide-cell directives)
├── media/
│   └── custom.css         ← Custom font (Inter) and typography
├── extensions/            ← Utility scripts (auto notebook creation, markdown→pyodide)
├── .github/workflows/
│   └── deploy.yml         ← GitHub Actions: build → patch → deploy to Pages
└── templates/site/myst/book-theme/ ← Vendored book-theme (Remix/React SSR)
```

---

## Step-by-Step Flow

### 1. Content Authoring
Write Python code cells in `.md` pages using the `pyodide-cell` directive:

````markdown
:::{pyodide-cell}
:id: my-cell-id
import numpy as np
print(np.array([1, 2, 3]))
:::
````

Standard `.ipynb` notebooks work as regular Jupyter Book content (no Pyodide interactivity).

### 2. Build Pipeline (`.github/workflows/deploy.yml`)
```
pip install jupyter-book          # Install JB2 globally
jupyter-book build --site         # MyST builds site JSON + templates
python patch_theme.py             # Copy _static/, patch index.js (see below)
jupyter-book build --html         # Final HTML output in _build/html/
→ Deploy _build/html/ to GitHub Pages
```

### 3. Plugin: `:::{pyodide-cell}` → HTML div
`plugins/pyodide-block.mjs` registers the directive with MyST. At build time, each directive becomes:
```html
<div class="pyodide-cell" id="...">
  <div class="myst-code"><pre><code>...code...</code></pre></div>
</div>
```

### 4. Client-Side Transformation
After the page loads in the browser, `pyodide-transform.js`:
1. **Waits for React hydration** to settle (book-theme uses Remix SSR)
2. **Finds** all `<div class="pyodide-cell">` elements
3. **Hides** the original div, inserts an interactive wrapper with:
   - CodeMirror 5 syntax-highlighted editor
   - Run (Shift+Enter) + Clear buttons
4. **Creates a page-level rocket toolbar** (🚀) appended to `<body>`:
   - Restart Kernel, Try Jupyter, Google Colab
5. **Polls + MutationObserver** for React re-renders and SPA navigation

### 5. Pyodide Runtime
`pyodide-runner.js` manages the singleton Pyodide instance:
- Loads from CDN on first code run (~5-10s)
- Captures stdout, stderr, return values, matplotlib figures (base64 PNG)
- Shares kernel state across all cells on the same page

---

## Changes & Workarounds for GitHub Pages

These are the specific problems we encountered and the solutions implemented to make Pyodide cells work properly on GitHub Pages with the MyST book-theme.

### Problem 1: Book-theme has no `<head>` injection mechanism
**Issue:** The book-theme (Remix SSR) doesn't support custom `<script>` or `<link>` tags.
**Solution:** `patch_theme.py` —
- Copies `_static/` into the theme's `public/_static/` directory
- Patches `build/index.js` to inject `<link rel="stylesheet">` and `<script defer>` tags into the React-rendered `<head>` element
- Uses the existing `i` (BASE_URL) variable for correct path resolution on GitHub Pages subpath

### Problem 2: React hydration destroys DOM changes
**Issue:** React SSR first renders HTML on the server, then "hydrates" (re-renders) on the client. Any DOM changes made before hydration completes get overwritten.
**Solution:**
- Transform script waits for `requestIdleCallback` + 200ms delay before first transform
- Polls every 500ms (up to 30 times) to re-apply transforms undone by React
- Uses `MutationObserver` for SPA page navigation (Remix client-side routing)
- Hides original `<div>` (`display:none`) instead of replacing it, so React's virtual DOM still matches
- Rocket toolbar appended to `document.body` (outside React's `#root` mount point)

### Problem 3: Tailwind CSS Preflight breaks button layout
**Issue:** Tailwind's CSS reset (Preflight) includes `svg { display: block; vertical-align: middle; }`, which forces SVG icons in `inline-flex` buttons onto their own line, causing buttons to "scatter".
**Solution:** Override with higher specificity + `!important`:
```css
.pyodide-wrapper svg, .pyodide-rocket svg {
  display: inline !important;
  vertical-align: middle !important;
}
.pyodide-header { display: flex !important; }
.pyodide-controls { display: flex !important; }
.pyodide-btn { display: inline-flex !important; }
```

### Problem 4: Tailwind prose styles leak into code output
**Issue:** The book-theme's prose styles (`.article :where(pre)`) add background colour, padding, and border-radius to `<pre>` elements — including our code output `<pre>` tags.
**Solution:**
- The wrapper uses `not-prose` class (Tailwind utility) to opt out of prose styling
- Output `<pre>` elements get `!important` overrides: `background: transparent`, `padding: 0`, etc.

### Problem 5: Flash of unstyled content (FOUC) during transform
**Issue:** On page load, the raw `myst-code` block (with copy button) shows briefly before our JS replaces it with the interactive editor.
**Solution:** Pure CSS hides the raw content immediately (no JS needed):
```css
div.pyodide-cell:not([data-pyodide-transformed]) > .myst-code,
div.pyodide-cell:not([data-pyodide-transformed]) > div {
  display: none !important;
}
div.pyodide-cell:not([data-pyodide-transformed])::before {
  content: '▶ Interactive Python — loading editor…';
  /* pulsing loading indicator */
}
```

### Problem 6: Article grid column placement
**Issue:** The book-theme uses CSS named grid columns (`grid-column: body`). Our dynamically-inserted wrapper didn't have explicit grid placement, potentially spanning wrong columns.
**Solution:** Both `.pyodide-wrapper` and `div.pyodide-cell` get `grid-column: body` in CSS, plus the wrapper receives the `col-body` utility class.

### Problem 7: Dark mode
**Issue:** Book-theme uses `html.dark` class (not just `prefers-color-scheme: dark`).
**Solution:** All styles have both `html.dark .pyodide-*` selectors AND `@media (prefers-color-scheme: dark)` fallback rules, covering both toggle-based and OS-level dark mode.

---

## PR Strategy

### PR 1: Pyodide Plugin + Static Assets (core feature)
The main PR that adds interactive code functionality:
- `plugins/pyodide-block.mjs` — MyST directive
- `_static/pyodide-runner.js` — Runtime manager
- `_static/pyodide-transform.js` — DOM transformer + UI
- `_static/pyodide.css` — All styles
- `_static/codemirror/` — Editor files (JS + CSS)
- `patch_theme.py` — Theme injection script

### PR 2: Build & Deploy Pipeline
- `.github/workflows/deploy.yml` — GitHub Actions workflow
- `requirements.txt` — Python dependencies

### PR 3: Content & Documentation
- `notebooks/` — Example pages (pyodide_example.md, pyodide_usage.md, etc.)
- `HOW_IT_WORKS.md` — This file
- `intro.md`, `README.md` updates

### PR 4: Extensions / Utilities (optional)
- `extensions/auto_notebook_creation_using_toc.py`
- `extensions/markdown_code_to_pyodide.mjs`
- `extensions/myst_code_to_pyodide.py`

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Pyodide via CDN (jsdelivr) | Smaller repo, faster updates, browser caching |
| CodeMirror 5 (not 6) | Simpler 1-file setup, sufficient for Python editing |
| `patch_theme.py` injection | Book-theme has no `custom_head` config |
| Rocket toolbar on `<body>` | React manages `#root`; body elements survive hydration |
| `!important` on flex layouts | Tailwind Preflight resets break inline-flex buttons |
| MutationObserver + polling | Handles both React re-renders and SPA navigation |
| Pure CSS anti-FOUC | Hides raw code block before JS runs — no flash |
| `col-body` grid placement | Explicit column in the book-theme article grid |

---

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt
npm install -g jupyter-book    # or use: npx jupyter-book

# Build
jupyter-book build --site
python patch_theme.py
jupyter-book build --html

# Serve locally
cd _build/html && python -m http.server 8000
```

## Deployment
GitHub Actions (`.github/workflows/deploy.yml`) automatically builds and deploys to GitHub Pages on push to `main`.
