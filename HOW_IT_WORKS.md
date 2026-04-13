# How This Project Works — Complete Technical Reference

> **Purpose of this file:** This is the single-source-of-truth for understanding every aspect of this project. Show this file to an AI assistant to give it full context for debugging, modifying, or extending the codebase.

## Overview

This is a **JupyterBook v2 (MyST)** template with **interactive Pyodide code cells** that run Python entirely in the browser via WebAssembly. No server is required — all code execution happens client-side on GitHub Pages.

**Live site:** <https://chandraveshchaudhari.github.io/jupyterbook2_with_lite_template/>
**Repository:** <https://github.com/chandraveshchaudhari/jupyterbook2_with_lite_template>

---

## Tech Stack

| Technology | Exact Version | Role |
|---|---|---|
| **[Jupyter Book v2](https://jupyterbook.org)** | 2.1.4 | Static site generator (wraps MyST) |
| **[MyST (Markedly Structured Text)](https://mystmd.org)** | 1.8.3 | Markdown parser, plugin system, builds HTML |
| **[Remix](https://remix.run)** | 1.17.1 (`@remix-run/dev`) | Server-side rendering (SSR) during build + client hydration |
| **[React](https://react.dev)** | 18.2.x | UI rendering (bundled in Remix) |
| **[Tailwind CSS](https://tailwindcss.com)** | 3.4.18 | Utility-first CSS framework for styling |
| **[Turborepo](https://turbo.build)** | latest | Monorepo build orchestration |
| **[Pyodide](https://pyodide.org)** | 0.29.3 (CDN) | CPython → WebAssembly, runs Python in the browser |
| **[CodeMirror 5](https://codemirror.net/5)** | 5.65.18 (minified, vendored) | Syntax-highlighted code editor in the browser |
| **[Express](https://expressjs.com)** | 4.18.x | Theme's HTTP server (runs during `build --html`) |
| **GitHub Pages** | — | Static file hosting |
| **GitHub Actions** | — | CI/CD pipeline (Node 22 LTS + Python 3.11) |

### Pre-installed Python packages (in Pyodide)
- `numpy`, `pandas`, `matplotlib` — loaded on first code execution

---

## Project Structure

```
.
├── myst.yml                          ← Project config, TOC, plugins, site options
├── requirements.txt                  ← Python deps: jupyter-book, jupyterlite, nbformat, PyYAML
├── HOW_IT_WORKS.md                   ← This file
├── README.md
├── intro.md                          ← Landing page content
├── patch_theme.py                    ← Build script: copies rebuilt theme + _static/ into _build/
│
├── plugins/
│   └── pyodide-block.mjs            ← MyST directive plugin (:::{pyodide-cell})
│
├── _static/                          ← Static assets injected into theme at build time
│   ├── pyodide-runner.js             ← Pyodide singleton: load(), execute(), restart() [196 lines]
│   ├── pyodide-transform.js          ← DOM transformer + React bridge + rocket toolbar [746 lines]
│   ├── pyodide.css                   ← All cell + toolbar styles (light + dark mode) [591 lines]
│   ├── codemirror/
│   │   ├── codemirror.js             ← CodeMirror 5 core (minified, 170KB)
│   │   ├── python.js                 ← CodeMirror 5 Python syntax mode (6.5KB)
│   │   └── codemirror.css            ← CodeMirror 5 base styles (6KB)
│   └── pyodide/                      ← Local Pyodide WASM files (fallback, ~12MB total)
│       ├── pyodide.js
│       ├── pyodide.asm.js
│       ├── pyodide.asm.wasm
│       ├── pyodide-lock.json
│       └── python_stdlib.zip
│
├── media/
│   ├── custom.css                    ← Inter font + typography overrides [12 lines]
│   └── images/
│       └── banner_image.png
│
├── notebooks/                        ← Content pages
│   ├── adding_contents.ipynb
│   ├── features.ipynb
│   ├── pyodide_example.md            ← Uses :::{pyodide-cell} directives
│   ├── pyodide_usage.md
│   └── section_markdown_page.md
│
├── extensions/                       ← Utility scripts (not used in build pipeline)
│   ├── auto_notebook_creation_using_toc.py
│   ├── markdown_code_to_pyodide.mjs
│   └── myst_code_to_pyodide.py
│
├── .github/workflows/
│   └── deploy.yml                    ← GitHub Actions CI/CD pipeline
│
├── _build/                           ← Generated at build time (gitignored)
│   ├── templates/site/myst/book-theme/  ← Stock theme downloaded by `build --site`
│   ├── site/                         ← Site JSON content
│   └── html/ or site/public/         ← Final static HTML output
│
└── templates/site/myst/book-theme/   ← VENDORED book-theme monorepo (our modified copy)
    ├── package.json                  ← Monorepo root (workspaces, devDeps, scripts)
    ├── package-lock.json
    ├── turbo.json                    ← Build task orchestration
    ├── patches/                      ← patch-package patches (run on postinstall)
    │   ├── @jupyter-widgets+controls+5.0.12.patch
    │   ├── jupyterlab-plotly+5.24.1.patch
    │   └── @types+react-syntax-highlighter+15.5.13.patch
    ├── packages/                     ← 14 workspace packages (compiled by turbo)
    │   ├── anywidget/    ├── providers/    ├── site/
    │   ├── common/       ├── search/       ├── tsconfig/
    │   ├── diagrams/     ├── search-minisearch/
    │   ├── frontmatter/  ├── icons/
    │   ├── jupyter/      ├── landing-pages/
    │   └── myst-to-react/  └── myst-demo/
    ├── styles/                       ← @myst-theme/styles package
    │   └── app.css                   ← Tailwind source → compiled to docs/public/tailwind.css
    └── themes/book/                  ← *** THE ACTUAL THEME WE MODIFY ***
        ├── package.json              ← Runtime deps only (express, @remix-run/express, etc.)
        ├── server.js                 ← Express server for Remix SSR [46 lines]
        ├── remix.config.prod.js      ← Remix build config (TRACKED in git)
        ├── remix.config.js           ← ⚠️ GITIGNORED — must be copied from .prod.js before build
        ├── tailwind.config.js        ← Extends @myst-theme/styles [11 lines]
        ├── .gitignore                ← Ignores: remix.config.js, app/styles/app.css, build/, public/build/
        ├── styles/
        │   └── app.css               ← Tailwind source input (imports @myst-theme/styles) [5 lines]
        ├── app/
        │   ├── root.tsx              ← *** MODIFIED: imports PyodideCell, injects head CSS/scripts ***
        │   ├── styles/
        │   │   └── app.css           ← ⚠️ GITIGNORED — compiled Tailwind output (~122KB)
        │   └── components/
        │       └── PyodideCell.tsx    ← React renderer for pyodide-cell AST nodes
        ├── build/
        │   └── index.js              ← ⚠️ GITIGNORED — compiled Remix server bundle (~20MB)
        └── public/build/             ← ⚠️ GITIGNORED — compiled Remix client bundles
```

---

## Vendored Theme Monorepo Details

The vendored theme at `templates/site/myst/book-theme/` is a complete monorepo forked from [myst-templates/book-theme](https://github.com/myst-templates/book-theme).

### Root `package.json` (monorepo)
```json
{
  "workspaces": ["packages/*", "themes/*", "styles", "docs"],
  "scripts": {
    "postinstall": "patch-package --patch-dir patches",
    "build": "turbo run build"
  },
  "devDependencies": {
    "@remix-run/node": "~1.17.0",
    "@remix-run/react": "~1.17.0",
    "@remix-run/dev": "~1.17.0",        // ← in themes/article, hoisted
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.3.2",
    "turbo": "latest",
    "typescript": "^5.1.3",
    "patch-package": "^6.5.1"
    // ... other devDeps
  }
}
```

### `themes/book/package.json` (runtime)
```json
{
  "name": "@myst-theme/book",
  "version": "1.2.0",
  "scripts": { "start": "node ./server.js" },
  "dependencies": {
    "@remix-run/express": "^1.15.0",
    "@remix-run/node": "^1.15.0",
    "express": "^4.18.2",
    "compression": "^1.7.4",
    "get-port": "^5.1.1",
    "morgan": "^1.10.0"
  }
}
```

> **CRITICAL:** `@remix-run/react` is NOT in `themes/book/package.json`. It's only in the monorepo root `devDependencies`. It MUST be bundled into `build/index.js` via `remix.config.js` → `serverDependenciesToBundle: [/.*/]`. Without this config, `@remix-run/react` is left as an external require and crashes at runtime.

### `remix.config.prod.js` (the only tracked config)
```javascript
module.exports = {
  appDirectory: 'app',
  assetsBuildDirectory: 'public/build',
  serverBuildPath: 'build/index.js',
  serverModuleFormat: 'cjs',
  serverMinify: true,
  publicPath: '/myst_assets_folder/',
  ignoredRouteFiles: ['**/.*'],
  serverDependenciesToBundle: [/.*/],   // ← BUNDLES ALL DEPS into server build
  future: {
    v2_routeConvention: true,
    v2_normalizeFormMethod: true,
    v2_headers: true,
    v2_meta: true,
    v2_errorBoundary: true,
  },
};
```

### `.gitignore` (themes/book/) — critical items ignored
```
remix.config.js          # Built from remix.config.prod.js
/app/styles/app.css      # Compiled Tailwind output
/build/*                 # Remix server bundle
/public/build            # Remix client bundles
node_modules
```

### `tailwind.config.js`
```javascript
const mystTheme = require('@myst-theme/styles');
module.exports = {
  darkMode: 'class',
  content: mystTheme.content,
  theme: { extend: mystTheme.themeExtensions },
  plugins: [require('@tailwindcss/typography')],
  safelist: mystTheme.safeList,
};
```

### `styles/app.css` (Tailwind source input — 5 lines)
```css
@import '@myst-theme/styles';
@import './grid-system.css';
#myst-no-css { --has-styling: 1; }
```

### `server.js` (Express SSR server — 46 lines)
```javascript
const { createRequestHandler } = require('@remix-run/express');
const { installGlobals } = require('@remix-run/node');
installGlobals();
const BUILD_DIR = path.join(process.cwd(), 'build');
// ... express setup ...
app.use('/myst_assets_folder', express.static('public/build', { immutable: true, maxAge: '1y' }));
app.use(express.static('public', { maxAge: '1h' }));
app.all('*', createRequestHandler({ build: require(BUILD_DIR), mode: process.env.NODE_ENV }));
// auto-finds port in range 3000–3100
```

### `turbo.json`
```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "api/**", "public/build/**"] },
    "compile": { "dependsOn": ["^compile"], "outputs": ["dist/**"] }
  }
}
```

### Patches (run on `npm install` via `postinstall`)
| Patch File | Purpose |
|---|---|
| `@jupyter-widgets+controls+5.0.12.patch` | Fix for Remix v1 bundling |
| `jupyterlab-plotly+5.24.1.patch` | Fix for Remix v1 bundling |
| `@types+react-syntax-highlighter+15.5.13.patch` | TypeScript type fix |

> **IMPORTANT:** Patch filenames include the exact installed version. If versions change (e.g., `npm install` resolves a newer minor), patches won't apply. Regenerate with `npx patch-package <package-name>`.

---

## Theme Customizations (Our Changes to book-theme)

### `app/root.tsx` — Key modifications

1. **PyodideCell renderer registration:**
   ```typescript
   import { PyodideCellRenderer } from './components/PyodideCell';

   const PYODIDE_RENDERERS: NodeRenderers = {
     div: { 'div[class=pyodide-cell]': PyodideCellRenderer },
   };

   const RENDERERS: NodeRenderers = mergeRenderers([
     defaultRenderers, JUPYTER_RENDERERS, LANDING_PAGE_RENDERERS,
     ANY_RENDERERS, PYODIDE_RENDERERS,
   ]);
   ```

2. **Head CSS/script injections** (via `links` export):
   - `~/styles/app.css` (compiled Tailwind)
   - `thebe-core/dist/lib/thebe-core.css`
   - jupyter-matplotlib CSS (CDN)
   - Font Awesome 4.7 (CDN)

3. **Loader** provides: `theme`, `config`, `CONTENT_CDN_PORT` (3100), `MODE` ('app'|'static'), `BASE_URL`

### `app/components/PyodideCell.tsx` — React component

```typescript
export const PyodideCellRenderer: NodeRenderer = ({ node }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const codeNode = node.children?.find((c: any) => c.type === 'code');
  const code = codeNode?.value || '';
  const cellId = node.identifier || node.html_id || '';

  React.useEffect(() => {
    // After hydration, calls window.__initPyodideCell(el, code, cellId)
    // This function is provided by pyodide-transform.js
    // Polls briefly if not yet available
  }, [code, cellId]);

  return (
    <div ref={ref} className="pyodide-cell col-body" id={cellId}
         data-pyodide-transformed="true" />
  );
};
```

**Architecture:** Lives inside React's tree (no hydration mismatch). On mount, delegates to `window.__initPyodideCell()` from `pyodide-transform.js` which builds the CodeMirror editor + buttons inside the container ref.

---

## Build Pipeline — Exact CI Steps

### `.github/workflows/deploy.yml`

```yaml
env:
  BASE_URL: /${{ github.event.repository.name }}
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'   # For GitHub Actions runtime only
```

**Job: build** (ubuntu-latest, Python 3.11, Node 22 LTS)

| Step | Command | What It Does |
|---|---|---|
| 1. Checkout | `actions/checkout@v4` | Clone repo |
| 2. Python 3.11 | `actions/setup-python@v5` | For jupyter-book + jupyterlite |
| 3. Node 22 LTS | `actions/setup-node@v4` | For monorepo build |
| 4. Install JB2 | `npm install -g jupyter-book` | Global CLI |
| 5. Python deps | `pip install -r requirements.txt` | jupyter-book, jupyterlite, etc. |
| 6. Build site content | `jupyter-book build --site` | Parses content → JSON in `_build/site/`. Downloads stock theme to `_build/templates/site/myst/book-theme/`. |
| 7. Rebuild theme | *(see below)* | Compiles our modified theme from source |
| 8. Patch theme | `python patch_theme.py` | Copies rebuilt `build/index.js` + `public/build/` + `_static/` into `_build/templates/` |
| 9. Build HTML | `jupyter-book build --html` | Starts theme server (Remix SSR), renders each page to static HTML in `_build/html/` or `_build/site/public/` |
| 10. JupyterLite | `jupyter lite build ...` | Builds standalone JupyterLite lab into HTML output |
| 11. Upload | `upload-pages-artifact@v3` | Upload to GitHub Pages |

### Step 7: Theme Rebuild (detailed)

```bash
cd templates/site/myst/book-theme
npm install                           # Install all monorepo deps + run postinstall (patch-package)
npx turbo run build                   # Compile 14 workspace packages (dist/ directories)
cd themes/book
cp remix.config.prod.js remix.config.js   # ⚠️ CRITICAL: config is gitignored, must copy
npx tailwindcss -c tailwind.config.js \
  -i styles/app.css \
  -o app/styles/app.css --minify      # Compile Tailwind CSS (~122KB output)
npx remix build                       # Build Remix app → build/index.js (~20MB) + public/build/
```

### `patch_theme.py` — What It Copies

```
templates/site/myst/book-theme/themes/book/build/index.js
    → _build/templates/site/myst/book-theme/build/index.js

templates/site/myst/book-theme/themes/book/public/build/*
    → _build/templates/site/myst/book-theme/public/build/*

_static/pyodide-runner.js
_static/pyodide-transform.js
_static/pyodide.css
_static/codemirror/*
    → _build/templates/site/myst/book-theme/public/_static/*
```

### Build Output: `build/index.js`
- ~20MB, ~15,333 lines (minified CJS)
- ALL dependencies bundled (including `@remix-run/react`, `react`, `react-dom`)
- Only external requires: Node builtins + `ajv/dist/runtime/*`, `bufferutil`, `encoding`, `utf-8-validate`
- Includes our `PyodideCellRenderer` component
- `serverDependenciesToBundle: [/.*/]` ensures nothing is externalized

---

## Plugin: `plugins/pyodide-block.mjs`

```javascript
const pyodideCellDirective = {
  name: 'pyodide-cell',
  alias: ['python-cell'],
  options: { id: { type: String } },
  body: { type: String, doc: 'Python source code' },
  run(data) {
    const cellId = data.options?.id ?? data.arg ?? `pyodide-${Math.random().toString(36).slice(2, 9)}`;
    return [{
      type: 'div', class: 'pyodide-cell', identifier: cellId,
      children: [{ type: 'code', lang: 'python', value: data.body ?? '' }],
    }];
  },
};
export default { name: 'Pyodide Interactive Cells', directives: [pyodideCellDirective] };
```

Registered in `myst.yml`:
```yaml
project:
  plugins:
    - plugins/pyodide-block.mjs
```

Content authoring:
````markdown
:::{pyodide-cell}
:id: my-cell-id
import numpy as np
print(np.array([1, 2, 3]))
:::
````

---

## Static Assets Detail

### `_static/pyodide-runner.js` (196 lines)
- IIFE wrapper, strict mode
- Pyodide CDN URL: `https://cdn.jsdelivr.net/pyodide/v0.29.3/full/`
- Singleton: `pyodideInstance`, `loadingPromise`
- Pre-loads: `numpy`, `pandas`, `matplotlib`
- `_loadPyodide()`: loads WASM, installs stdout/stderr JS bridge, sets matplotlib to AGG backend
- `window._pyodideStreamWrite()`: callback for capturing output
- Matplotlib figure extraction via base64 PNG encoding
- **Public API:** `window.PyodideRunner.load()`, `.restart()`, `.execute(code, cellRef)`
- Returns: `{ stdout, stderr, figures, error, returnValue, durationMs }`

### `_static/pyodide-transform.js` (746 lines)
| Section | Lines | Purpose |
|---|---|---|
| Cell counter & helpers | ~15 | Stable IDs, code extraction from AST |
| Rocket toolbar | ~180 | Floating 🚀 launcher: Restart Kernel, Try Jupyter, Google Colab buttons. Updates links per source file. |
| `buildCell()` | ~250 | Creates wrapper div → header bar → CodeMirror editor → status bar → output area. Run handler executes via PyodideRunner. |
| `window.__initPyodideCell()` | ~200 | React-safe entry point called by `PyodideCellRenderer.useEffect()`. Same editor + execution engine. |
| Bootstrap & observers | ~60 | `transformAllCells()`, `MutationObserver`, `requestIdleCallback` |

### `_static/pyodide.css` (591 lines)
- Pyodide wrapper, header bar, controls (Run/Clear buttons)
- CodeMirror editor container styling
- Output area (stdout, stderr, error, matplotlib figures)
- Status bar with timing display
- Rocket toolbar positioning & dropdown menu
- Dark mode: both `html.dark .pyodide-*` AND `@media (prefers-color-scheme: dark)`
- Tailwind Preflight overrides (`!important` on SVG display, flex layouts)
- Anti-FOUC: pure CSS loading indicator before JS runs
- Grid placement: `grid-column: body` for book-theme article grid

---

## Content Rendering Flow (Runtime)

```
1. Browser loads page HTML (pre-rendered by Remix SSR)
       ↓
2. React hydration begins (Remix client-side)
       ↓
3. PyodideCellRenderer mounts for each div.pyodide-cell AST node
       ↓
4. useEffect fires → calls window.__initPyodideCell(container, code, cellId)
       ↓
5. pyodide-transform.js builds CodeMirror editor + buttons inside container
       ↓
6. User clicks Run (or Shift+Enter)
       ↓
7. PyodideRunner.execute(code) loads Pyodide WASM on first call (~5-10s)
       ↓
8. Results rendered: stdout, stderr, matplotlib figures (base64 PNG), errors, timing
```

For SPA navigation (Remix client-side routing):
- `MutationObserver` detects new `div.pyodide-cell` elements
- `transformAllCells()` runs to initialize newly appeared cells

---

## Problems Solved & Workarounds

### Problem 1: No `<head>` injection in book-theme
**Issue:** Book-theme (Remix SSR) has no config for custom `<script>` / `<link>` tags.
**Solution:** `root.tsx` modified to import our CSS/JS. Static assets served from `public/_static/` (copied by `patch_theme.py`). Script tags injected via Remix's `links` export and direct `<script>` tags in the App component.

### Problem 2: React hydration destroys DOM changes
**Issue:** React SSR hydration overwrites any DOM mutations made before it completes.
**Solution:** `PyodideCellRenderer` is a proper React component inside the render tree — no DOM mutation needed. It calls `window.__initPyodideCell()` from `useEffect` (post-hydration). The rocket toolbar is appended to `document.body` (outside React's `#root`).

### Problem 3: Tailwind Preflight breaks inline-flex buttons
**Issue:** `svg { display: block }` forces SVG icons in buttons onto separate lines ("scatter").
**Solution:** Higher-specificity overrides with `!important`:
```css
.pyodide-wrapper svg, .pyodide-rocket svg { display: inline !important; vertical-align: middle !important; }
.pyodide-header { display: flex !important; }
.pyodide-controls { display: flex !important; }
.pyodide-btn { display: inline-flex !important; }
```

### Problem 4: Tailwind prose styles leak into output
**Issue:** `.article :where(pre)` adds unwanted background/padding to output `<pre>` tags.
**Solution:** Wrapper uses `not-prose` class. Output `<pre>` gets `!important` overrides: `background: transparent`, `padding: 0`.

### Problem 5: FOUC (Flash of unstyled content)
**Issue:** Raw `myst-code` block shows briefly before JS replaces it.
**Solution:** Pure CSS hides content before JS runs:
```css
div.pyodide-cell:not([data-pyodide-transformed]) > .myst-code { display: none !important; }
div.pyodide-cell:not([data-pyodide-transformed])::before {
  content: '▶ Interactive Python — loading editor…';
}
```

### Problem 6: Grid column placement
**Issue:** Book-theme uses CSS named grid columns. Injected wrappers span wrong columns.
**Solution:** `.pyodide-wrapper` and `div.pyodide-cell` get `grid-column: body` + `col-body` class.

### Problem 7: Dark mode
**Issue:** Book-theme uses `html.dark` class, not `prefers-color-scheme`.
**Solution:** All styles use both `html.dark .pyodide-*` selectors AND `@media (prefers-color-scheme: dark)` fallback.

### Problem 8: `remix.config.js` gitignored — CI has no config
**Issue:** `themes/book/.gitignore` excludes `remix.config.js` (comment: "This is ignored as it is built"). In CI, `npx remix build` runs with no config file → Remix uses defaults → `@remix-run/react` is NOT bundled → runtime crash: `Cannot find module '@remix-run/react'`.
**Solution:** CI step copies tracked file before build: `cp remix.config.prod.js remix.config.js`

### Problem 9: `app/styles/app.css` gitignored — esbuild deadlock
**Issue:** `themes/book/.gitignore` excludes compiled Tailwind output. `root.tsx` imports `~/styles/app.css`. Without this file, esbuild deadlocks during `npx remix build`.
**Solution:** CI compiles Tailwind before Remix build:
```bash
npx tailwindcss -c tailwind.config.js -i styles/app.css -o app/styles/app.css --minify
```

### Problem 10: patch-package version mismatches
**Issue:** Patches embed exact version numbers (e.g., `@jupyter-widgets+controls+5.0.11.patch`). If `npm install` resolves a different version (e.g., `5.0.12`), patches silently fail.
**Solution:** Regenerated patches with `npx patch-package <package>` after `npm install`. Current versions: `@jupyter-widgets/controls@5.0.12`, `jupyterlab-plotly@5.24.1`.

### Problem 11: Turbo workspace packages not compiled
**Issue:** The monorepo has 14 packages under `packages/` that must produce `dist/` directories before the Remix build can import them (e.g., `@myst-theme/site`, `@myst-theme/providers`).
**Solution:** CI runs `npx turbo run build` before `npx remix build`. This compiles all workspace packages in dependency order.

### Problem 12: Node.js version compatibility
**Issue:** Node 24 (bleeding edge, not LTS) caused issues with Remix v1.17.
**Solution:** CI uses Node 22 LTS. Local dev tested on Node 20.x.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Pyodide via CDN (jsdelivr) | Smaller repo, faster updates, browser caching |
| CodeMirror 5 (not 6) | Simpler 1-file setup, sufficient for Python editing |
| Vendored monorepo in `templates/` | Full control over theme source for custom components |
| `PyodideCellRenderer` React component | Lives inside React tree — no hydration mismatch |
| `window.__initPyodideCell()` bridge | React component delegates to vanilla JS for editor creation |
| Rocket toolbar on `<body>` | Outside React's `#root` — survives any re-render |
| `!important` on flex layouts | Tailwind Preflight resets break inline-flex buttons |
| Pure CSS anti-FOUC | Hides raw code block before JS runs — no flash |
| `col-body` grid placement | Explicit column in the book-theme article grid |
| `serverDependenciesToBundle: [/.*/]` | Bundles ALL deps — theme's package.json lacks most deps |
| `cp remix.config.prod.js remix.config.js` | .gitignore excludes config; must copy in CI |
| Node 22 LTS in CI | Stability with Remix v1.17 |

---

## `myst.yml` Configuration

```yaml
version: 1
project:
  title: JupyterBook v2 + JupyterLite Template
  plugins:
    - plugins/pyodide-block.mjs        # Registers :::{pyodide-cell} directive
  jupyter:
    lite: true                          # Enables ⚡ power button for JupyterLite
  binder: https://mybinder.org/v2/gh/chandraveshchaudhari/jupyterbook2_with_lite_template/HEAD
  banner: media/images/banner_image.png
  toc:
    - file: intro.md
    - title: Getting Started
      children:
        - file: notebooks/adding_contents.ipynb
    - title: Pyodide Examples
      children:
        - file: notebooks/pyodide_example.md
        - file: notebooks/pyodide_usage.md
    - title: Features & Showcase
      children:
        - file: notebooks/features.ipynb
        - file: notebooks/section_markdown_page.md
site:
  template: book-theme
  options:
    logo: media/images/banner_image.png
    folders: true                       # Clean /page/ URLs
    style: media/custom.css             # Inter font + typography
```

---

## Local Development

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Install Jupyter Book CLI
npm install -g jupyter-book

# 3. Build site content (downloads stock theme to _build/)
jupyter-book build --site

# 4. Rebuild our custom theme (if changing theme source)
cd templates/site/myst/book-theme
npm install
npx turbo run build
cd themes/book
cp remix.config.prod.js remix.config.js
npx tailwindcss -c tailwind.config.js -i styles/app.css -o app/styles/app.css --minify
npx remix build
cd ../../../..

# 5. Patch the downloaded theme with our custom build
python patch_theme.py

# 6. Build final HTML
jupyter-book build --html

# 7. Serve locally
cd _build/html && python -m http.server 8000
# or: cd _build/site/public && python -m http.server 8000
```

### Quick iteration (content changes only — no theme changes):
```bash
jupyter-book build --site
python patch_theme.py
jupyter-book build --html
```

### Live dev server (runs Remix dev server with hot reload):
```bash
cd templates/site/myst/book-theme/themes/book
cp remix.config.prod.js remix.config.js
cd ../..
npm run theme:book
# In another terminal:
myst start
```

---

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) automatically builds and deploys to GitHub Pages on push to `main`. Manual trigger also available via `workflow_dispatch`.

---

## Commit History (key milestones)

| Commit | Description |
|---|---|
| `029bded` | fix(ci): copy remix.config.prod.js before build + Node 22 LTS |
| `e64661f` | fix: add Tailwind CSS compilation step + update patch versions |
| `3c9c12c` | fix: run turbo build to compile monorepo packages before remix build |
| `7041aed` | feat: PyodideCell React component — no more hydration scatter |
| `66b1eff` | fix: hydration scatter, JupyterLite lab, Colab links |
| `5de9bc9` | fix: UI scatter on GitHub Pages + restore CodeMirror + tech docs |
| `6776d0f` | fix: launch try-jupyter URL, output colors, dark mode, prose overrides |
| `e5d7e59` | fix: restore working Pyodide UI, add book-theme template source |

---

## Known Limitations

1. **45 npm audit vulnerabilities** — All from Remix v1 transitive dependencies. Cannot fix without migrating to Remix v2 (breaking changes).
2. **~20MB server bundle** — `serverDependenciesToBundle: [/.*/]` bundles everything. Large but necessary since the stock theme `package.json` lacks most runtime deps.
3. **Pyodide first-load latency** — ~5-10 seconds on first code execution (downloads WASM runtime from CDN).
4. **CodeMirror 5** — Older version; CodeMirror 6 has better architecture but requires multi-file setup.
5. **No hot reload for Pyodide cells** — When using `myst start`, Pyodide cells only work after full page reload.
