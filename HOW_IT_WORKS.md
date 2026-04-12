# How This Project Works

## Overview

This is a **JupyterBook v2 (MyST)** template with **interactive Pyodide code cells** that run Python entirely in the browser via WebAssembly. No server is required — all code execution happens client-side.

**Live site:** <https://chandraveshchaudhari.github.io/jupyterbook2_with_lite_template/>

---

## Architecture

```
myst.yml                   ← Project config, TOC, plugins, site options
├── plugins/
│   └── pyodide-block.mjs  ← MyST directive plugin (defines :::{pyodide-cell})
├── _static/
│   ├── pyodide-runner.js  ← Pyodide singleton: load(), execute(), restart()
│   ├── pyodide-transform.js ← DOM transformer: cells → CodeMirror editors + rocket toolbar
│   ├── pyodide.css        ← All cell + rocket toolbar styles (light/dark)
│   ├── codemirror/
│   │   └── init-codemirror.js ← CodeMirror 5 + Python mode loader (CDN)
│   └── pyodide/           ← (Optional) local Pyodide assets (currently using CDN)
├── patch_theme.py         ← Build script: copies _static/ into theme, patches index.js
├── notebooks/             ← Content pages (.ipynb and .md with pyodide-cell directives)
├── media/
│   └── custom.css         ← Custom font (Inter) and typography
├── extensions/            ← Utility scripts (auto notebook creation, markdown→pyodide)
└── templates/site/myst/book-theme/ ← Vendored book-theme (Remix/React SSR)
```

## How It Works Step-by-Step

### 1. Content Authoring

Write Python code cells in your `.md` pages using the `pyodide-cell` directive:

````markdown
:::{pyodide-cell}
:id: my-cell-id
import numpy as np
print(np.array([1, 2, 3]))
:::
````

Or use standard `.ipynb` notebooks — they work as regular Jupyter Book content.

### 2. MyST Plugin (`plugins/pyodide-block.mjs`)

Registers the `:::{pyodide-cell}` directive with MyST. During build, each directive becomes a `<div class="pyodide-cell" id="..."><pre><code>...</code></pre></div>` in the rendered HTML.

### 3. Build Pipeline (`.github/workflows/deploy.yml`)

```
jupyter-book build --site     # MyST builds the site
python patch_theme.py         # Copies _static/ into theme's public folder
                              # Patches build/index.js to inject <script>/<link> tags
jupyter-book build --html     # Final HTML output
```

### 4. Client-Side Transformation (`_static/pyodide-transform.js`)

After the page loads in the browser:

1. **Waits for React hydration** (the book-theme uses Remix/React SSR)
2. **Finds all `<div class="pyodide-cell">`** elements
3. **Replaces each** with a full interactive editor:
   - CodeMirror 5 syntax-highlighted editor
   - Run button (Shift+Enter) + Clear button
4. **Creates a page-level rocket toolbar** (🚀) appended to `<body>`:
   - **Restart Kernel** — resets the Pyodide runtime
   - **Try Jupyter** — opens jupyter.org/try-jupyter
   - **Google Colab** — opens the notebook in Colab (for `.ipynb` pages)
5. **Polls + MutationObserver** to handle React re-renders and SPA navigation

### 5. Pyodide Runtime (`_static/pyodide-runner.js`)

- Loads Pyodide v0.29.3 from CDN (jsdelivr)
- Pre-installs: `numpy`, `pandas`, `matplotlib`
- Provides: `load()`, `execute(code)`, `restart()`, `isReady`
- Captures: stdout, stderr, return values, matplotlib figures (as base64 PNG)

### 6. Patch Theme (`patch_theme.py`)

The book-theme doesn't natively support custom `<script>` or `<link>` tags. This script:
- Copies `_static/` into the theme's `public/` folder
- Finds `createElement("head"` in `build/index.js`
- Injects CodeMirror, Pyodide CSS, and Pyodide JS `<script>`/`<link>` tags

---

## PR Strategy

### PR 1: Template / Book-Theme Customization
**Target:** The vendored `templates/site/myst/book-theme/` or upstream `jupyter-book/book-theme`

- `patch_theme.py` (or propose a generic "custom head scripts" feature)
- Custom CSS in `media/custom.css`
- Any theme-level changes

### PR 2: Pyodide Plugin + Static Assets
**Target:** This repository or a standalone `myst-pyodide-plugin` package

- `plugins/pyodide-block.mjs` — the MyST directive
- `_static/pyodide-runner.js` — Pyodide runtime manager
- `_static/pyodide-transform.js` — DOM transformer + rocket toolbar
- `_static/pyodide.css` — all styles
- `_static/codemirror/init-codemirror.js` — CodeMirror loader

### PR 3: Extensions / Utilities
**Target:** This repository

- `extensions/auto_notebook_creation_using_toc.py`
- `extensions/markdown_code_to_pyodide.mjs`
- `extensions/myst_code_to_pyodide.py`

### PR 4: Documentation + Content
**Target:** This repository

- `intro.md`, `notebooks/` content pages
- `HOW_IT_WORKS.md` (this file)
- `README.md` updates

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Pyodide via CDN (not local) | Smaller repo, faster updates, browser caching |
| CodeMirror 5 (not 6) | Simpler setup, single-file load, sufficient for Python editing |
| `patch_theme.py` injection | Book-theme has no `custom_head` config; patching `index.js` is the only way |
| Rocket toolbar on `<body>` | React manages `#root`; body-appended elements survive hydration |
| `!important` on flex layouts | Tailwind Preflight resets (`svg { display: block }`) break inline-flex buttons |
| MutationObserver + polling | Handles both React re-renders and SPA page navigation |

---

## Local Development

```bash
# Install
pip install -r requirements.txt
npm install -g jupyter-book

# Build
jupyter-book build --site
python patch_theme.py
jupyter-book build --html

# Serve locally
cd _build/html && python -m http.server 8000
# or: jupyter-book start (uses myst dev server)
```

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) automatically builds and deploys to GitHub Pages on push to `main`.
