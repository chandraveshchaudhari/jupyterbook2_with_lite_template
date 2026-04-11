# Pyodide Interactive Cells for MyST JupyterBook v2

## Architecture overview

```
your-book/
├── myst.yml                        # MyST v2 config — registers plugin, injects scripts
├── plugins/
│   └── pyodide-block.mjs           # Build-time AST transform (MyST plugin)
├── _static/
│   ├── pyodide-runner.js           # Runtime: Pyodide singleton + execution engine
│   ├── pyodide-transform.js        # Runtime: DOM wiring + CodeMirror init
│   ├── pyodide.css                 # Cell styles (light + dark mode)
│   ├── pyodide/                    # Pyodide runtime files (local)
│   │   ├── pyodide.js
│   │   ├── pyodide.asm.js
│   │   ├── pyodide_py.tar
│   │   └── … (all pyodide dist files)
│   └── codemirror/                 # CodeMirror 5 pre-bundled
│       ├── codemirror.js
│       ├── codemirror.css
│       └── python.js               # Python mode addon
└── notebooks/
    └── example-usage.md            # Your content
```

## Why this architecture is better than DOM scraping alone

MyST v2 renders pages using **React** (not plain Sphinx HTML). On page load,
React **hydrates** server-rendered HTML. A script that scans for `<code>` tags
at `DOMContentLoaded` may run before or after React replaces the DOM nodes.

This implementation avoids that race by:

1. **MyST plugin (`pyodide-block.mjs`)**: At **build time**, converts
   ` ```python python_code_block ``` ` fences into
   `<div class="pyodide-cell" data-code="...">` nodes in the AST.
   These survive as raw HTML through React hydration.

2. **MutationObserver** in `pyodide-transform.js` watches for `pyodide-cell`
   divs added to the DOM at any point — covers both initial render and any
   deferred React rendering.

## Setup steps

### 1. Download Pyodide (local)

```bash
# Get the latest Pyodide release
curl -L https://github.com/pyodide/pyodide/releases/download/0.27.0/pyodide-0.27.0.tar.bz2 \
  | tar xj -C _static/
mv _static/pyodide-0.27.0 _static/pyodide
```

Only include the packages you need to keep download size reasonable.
Minimum required: `pyodide.js`, `pyodide.asm.js`, `pyodide_py.tar`,
`packages.json`, `numpy`, `pandas`, `matplotlib` package files.

### 2. Download CodeMirror 5 (local)

```bash
mkdir -p _static/codemirror
# Download from cdnjs or bundle manually
curl -o _static/codemirror/codemirror.js \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js
curl -o _static/codemirror/codemirror.css \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css
curl -o _static/codemirror/python.js \
  https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/python/python.min.js
```

### 3. Install the plugin and build

```bash
pip install mystmd
myst build --html
```

The plugin is auto-loaded because it's listed in `myst.yml`:
```yaml
project:
  plugins:
    - plugins/pyodide-block.mjs
```

### 4. Verify the transform ran

After build, inspect `_build/html/your-page.html`. You should see:
```html
<div class="pyodide-cell" data-cell-id="hello" data-code="print%28...%29"></div>
```
If you still see a `<code>` block, the plugin didn't transform it — check that
the language string is exactly `python python_code_block`.

## Known limitations and workarounds

### `html_head_extra` / `html_footer_extra` in myst.yml

MyST v2's theme options for injecting raw HTML vary by template version.
If `html_head_extra`/`html_footer_extra` don't work in your theme:

**Alternative**: Add a raw HTML block to a page (or `_includes/footer.html`):

```md
:::{raw} html
<link rel="stylesheet" href="/_static/codemirror/codemirror.css">
<link rel="stylesheet" href="/_static/pyodide.css">
<script src="/_static/pyodide/pyodide.js"></script>
<script src="/_static/codemirror/codemirror.js"></script>
<script src="/_static/codemirror/python.js"></script>
<script src="/_static/pyodide-runner.js" defer></script>
<script src="/_static/pyodide-transform.js" defer></script>
:::
```

### Absolute vs relative paths

Scripts in `myst.yml` use `/_static/…` (absolute from site root).
This works on GitHub Pages with a custom domain. If your site is deployed
to a **subdirectory** (e.g. `username.github.io/mybook/`), change to:

```yaml
html_head_extra: |
  <link rel="stylesheet" href="/mybook/_static/codemirror/codemirror.css">
```

Or use a `<base>` tag at the top of `html_head_extra`.

### Shared kernel state

All cells on the same page share one Python interpreter (by design — this
matches Jupyter's model). Variables set in one cell persist to others.
Each **page load** starts a fresh Pyodide instance.

### matplotlib backend

This implementation uses Pyodide's HTML5 canvas backend for matplotlib.
`plt.show()` captures figures as base64 PNGs and displays them inline.
Calling `plt.close('all')` between runs is handled automatically.
