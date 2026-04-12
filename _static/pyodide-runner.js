/**
 * pyodide-runner.js
 *
 * Pyodide singleton manager and Python execution engine.
 * Loaded once per page. Handles:
 *   - Single Pyodide instance shared across all cells
 *   - Loads Pyodide + packages from CDN (jsdelivr)
 *   - numpy, pandas, matplotlib preloading
 *   - stdout/stderr capture
 *   - matplotlib figure capture (AGG backend → base64 PNG)
 *   - Execution timing
 *
 * Exported as window.PyodideRunner for use by pyodide-transform.js
 */

(function () {
  'use strict';

  // ── CDN base URL ───────────────────────────────────────────────────────────
  const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';

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
      // Load pyodide.js from CDN
      if (typeof globalThis.loadPyodide !== 'function') {
        await loadScript(PYODIDE_CDN + 'pyodide.js');
      }
      if (typeof globalThis.loadPyodide !== 'function') {
        throw new Error(
          'loadPyodide is not defined after loading pyodide.js from CDN.'
        );
      }

      const py = await globalThis.loadPyodide({ indexURL: PYODIDE_CDN });

      // Preload scientific packages (fetched from CDN)
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

      // Set up matplotlib AGG backend (non-interactive, renders to PNG)
      py.runPython(`
import matplotlib
matplotlib.use("agg")
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
     * Destroy the current Pyodide instance and reset state so the next
     * load()/execute() call creates a fresh runtime with packages reloaded.
     */
    async restart() {
      if (pyodideInstance) {
        try { pyodideInstance.runPython('import sys; sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__'); } catch (_) {}
      }
      pyodideInstance = null;
      loadingPromise = null;
      // Re-initialise immediately so user doesn't have to click Run first
      return _loadPyodide();
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
