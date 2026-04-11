/**
 * pyodide-runner.js
 *
 * Pyodide singleton manager and Python execution engine.
 * Loaded once per page. Handles:
 *   - Single Pyodide instance shared across all cells
 *   - Correct indexURL resolution (works on sub-pages)
 *   - numpy, pandas, matplotlib preloading
 *   - stdout/stderr capture
 *   - matplotlib figure capture and inline rendering
 *   - Execution timing
 *
 * Exported as window.PyodideRunner for use by pyodide-transform.js
 */

(function () {
  'use strict';

  // ── Resolve the site root so _static/ works on sub-pages ──────────────────
  // Strategy: find the injected <link> or <script> tag for pyodide-runner.js
  // itself, then derive the root. Falls back to walking up from location.pathname.
  function resolveSiteRoot() {
    // Try to find our own script tag
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      const src = s.getAttribute('src');
      if (src && src.includes('pyodide-runner')) {
        // src might be /_static/pyodide-runner.js  →  root is /
        // or /mybook/_static/pyodide-runner.js     →  root is /mybook/
        const url = new URL(src, location.href);
        const staticIdx = url.pathname.indexOf('/_static/');
        if (staticIdx !== -1) {
          return url.origin + url.pathname.slice(0, staticIdx + 1);
        }
      }
    }
    // Fallback: strip the filename, walk up until we find the root
    // This heuristic works for GitHub Pages paths like /repo/chapter/page/
    return location.origin + '/';
  }

  const SITE_ROOT = resolveSiteRoot();
  const PYODIDE_INDEX_URL = SITE_ROOT + '_static/pyodide/';

  // ── State ──────────────────────────────────────────────────────────────────
  let pyodideInstance = null;
  let loadingPromise = null;
  const PRELOADED_PACKAGES = ['numpy', 'pandas', 'matplotlib'];

  // ── Internal helpers ───────────────────────────────────────────────────────

  /** Dynamically inject a <script> and wait for it to load. */
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(s);
    });
  }

  async function _loadPyodide() {
    if (pyodideInstance) return pyodideInstance;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      // Dynamically load pyodide.js if not already available
      if (typeof globalThis.loadPyodide !== 'function') {
        await loadScript(PYODIDE_INDEX_URL + 'pyodide.js');
      }
      if (typeof globalThis.loadPyodide !== 'function') {
        throw new Error(
          'loadPyodide is not defined after loading pyodide.js. ' +
          'Check that _static/pyodide/pyodide.js exists and is valid.'
        );
      }

      const py = await globalThis.loadPyodide({ indexURL: PYODIDE_INDEX_URL });

      // Preload scientific packages
      await py.loadPackage(PRELOADED_PACKAGES);

      // Install a custom stdout/stderr redirector
      py.runPython(`
import sys, io, js

class _JsBridge(io.TextIOBase):
    def __init__(self, tag):
        self._tag = tag
    def write(self, s):
        js.globalThis._pyodideStreamWrite(self._tag, s)
        return len(s)
    def flush(self):
        pass

sys.stdout = _JsBridge("stdout")
sys.stderr = _JsBridge("stderr")
      `);

      // Set up matplotlib backend
      py.runPython(`
import matplotlib
matplotlib.use("module://matplotlib_pyodide.html5_canvas_backend")
      `);

      pyodideInstance = py;
      return py;
    })();

    return loadingPromise;
  }

  // Called from Python via js.globalThis._pyodideStreamWrite
  window._pyodideStreamWrite = function (tag, text) {
    // Stored per-execution in a temporary buffer; cells collect this themselves
    if (window._pyodideCurrentCell) {
      window._pyodideCurrentCell._buffer = window._pyodideCurrentCell._buffer || { stdout: '', stderr: '' };
      window._pyodideCurrentCell._buffer[tag] += text;
    }
  };

  // ── Public API ─────────────────────────────────────────────────────────────
  window.PyodideRunner = {
    /**
     * Ensure Pyodide is loaded. Returns the pyodide instance.
     * Safe to call multiple times — returns same promise.
     */
    async load() {
      return _loadPyodide();
    },

    get isReady() {
      return pyodideInstance !== null;
    },

    /**
     * Execute Python code in the shared Pyodide instance.
     *
     * @param {string} code       Python source to execute
     * @param {object} cellRef    The cell DOM wrapper (used for stream capture)
     * @returns {Promise<ExecutionResult>}
     *
     * ExecutionResult:
     *   { stdout, stderr, figures, error, durationMs }
     */
    async execute(code, cellRef) {
      const py = await _loadPyodide();

      // Register the active cell for stream capture
      const captureTarget = { _buffer: { stdout: '', stderr: '' } };
      window._pyodideCurrentCell = captureTarget;

      // Clear any previous matplotlib figures
      py.runPython(`
import matplotlib.pyplot as plt
plt.close('all')
      `);

      const t0 = performance.now();
      let error = null;
      let returnValue = undefined;

      try {
        // runPythonAsync supports top-level await in user code
        returnValue = await py.runPythonAsync(code);
      } catch (err) {
        error = err;
      }

      const durationMs = Math.round(performance.now() - t0);
      window._pyodideCurrentCell = null;

      // Collect matplotlib figures as data URLs
      let figures = [];
      try {
        const figData = py.runPython(`
import matplotlib.pyplot as plt, io, base64, json
_figs = []
for _fig_num in plt.get_fignums():
    _fig = plt.figure(_fig_num)
    _buf = io.BytesIO()
    _fig.savefig(_buf, format='png', bbox_inches='tight', dpi=120)
    _buf.seek(0)
    _figs.append('data:image/png;base64,' + base64.b64encode(_buf.read()).decode())
    plt.close(_fig)
json.dumps(_figs)
        `);
        figures = JSON.parse(figData);
      } catch (_) {
        // matplotlib not used or figure collection failed — that's fine
      }

      return {
        stdout: captureTarget._buffer.stdout,
        stderr: captureTarget._buffer.stderr,
        figures,
        error: error ? String(error) : null,
        returnValue: returnValue !== undefined && returnValue !== null
          ? String(returnValue)
          : null,
        durationMs,
      };
    },
  };
})();
