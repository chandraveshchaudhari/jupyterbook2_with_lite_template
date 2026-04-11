/**
 * pyodide-transform.js
 *
 * Finds all <div class="pyodide-cell"> elements rendered by the MyST plugin.
 * Each div contains a <pre><code> block with the Python source. This script
 * replaces those divs with fully interactive UI:
 *   - CodeMirror 5 editor (editable, syntax-highlighted)
 *   - Run button  |  Clear button
 *   - Loading spinner during first Pyodide initialisation
 *   - Scrollable output (stdout + stderr + matplotlib figures)
 *   - Execution time display
 *
 * IMPORTANT: The MyST book-theme uses Remix (React). React hydrates the page
 * after the initial server-rendered HTML loads, which can undo DOM changes
 * made before hydration completes. This script therefore:
 *   1. Does NOT modify the DOM immediately on load
 *   2. Waits for React hydration to settle (via requestIdleCallback + delay)
 *   3. Uses polling to re-transform cells if React undoes transformations
 *   4. Uses a debounced MutationObserver for client-side (SPA) navigation
 *   5. Hides original placeholder (not replaceWith) so React reconciliation
 *      does not destroy our wrapper
 */

(function () {
  'use strict';

  // ── Cell counter for stable IDs ────────────────────────────────────────────
  var _cellIndex = 0;

  // ── Pyodide loading state (shared across all cells) ────────────────────────
  var _pyodideLoadState = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
  var _pyodideLoadError = null;

  // ── Extract code and id from a pyodide-cell div ────────────────────────────
  function extractCellData(el) {
    // The plugin creates: <div class="pyodide-cell"><div class="myst-code"><pre><code>…
    var codeEl = el.querySelector('pre code') || el.querySelector('code');
    var rawCode = codeEl ? codeEl.textContent : '';

    // Cell ID: from the div's id attribute (MyST uses identifier → id)
    var cellId = el.id || ('cell-' + (++_cellIndex));

    return { rawCode: rawCode, cellId: cellId };
  }

  // ── Build the cell UI ──────────────────────────────────────────────────────
  function buildCell(placeholder) {
    // Guard: skip already-transformed cells
    if (placeholder.dataset.pyodideTransformed === 'done') return;

    var data = extractCellData(placeholder);
    var rawCode = data.rawCode;
    var cellId = data.cellId;

    if (!rawCode.trim()) return; // Skip empty cells

    placeholder.dataset.pyodideTransformed = 'done';

    var uid = 'pycell-' + cellId;

    // If a stale wrapper exists from a previous transform cycle, remove it
    var stale = document.getElementById(uid);
    if (stale) stale.remove();

    // ── Wrapper ──────────────────────────────────────────────────────────────
    var wrapper = document.createElement('div');
    wrapper.className = 'pyodide-wrapper';
    wrapper.id = uid;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Interactive Python cell');

    // ── Header bar ───────────────────────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'pyodide-header';

    var badge = document.createElement('span');
    badge.className = 'pyodide-lang-badge';
    badge.textContent = 'Python';

    var controls = document.createElement('div');
    controls.className = 'pyodide-controls';

    var runBtn = document.createElement('button');
    runBtn.className = 'pyodide-btn pyodide-btn-run';
    runBtn.title = 'Run (Shift+Enter)';
    runBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
      '<path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg> Run';

    var clearBtn = document.createElement('button');
    clearBtn.className = 'pyodide-btn pyodide-btn-clear';
    clearBtn.title = 'Clear output';
    clearBtn.textContent = 'Clear';

    controls.appendChild(runBtn);
    controls.appendChild(clearBtn);
    header.appendChild(badge);
    header.appendChild(controls);

    // ── Editor area ──────────────────────────────────────────────────────────
    var editorContainer = document.createElement('div');
    editorContainer.className = 'pyodide-editor-container';

    var textarea = document.createElement('textarea');
    textarea.value = rawCode;
    textarea.setAttribute('aria-label', 'Python code editor');
    editorContainer.appendChild(textarea);

    // ── Status bar ───────────────────────────────────────────────────────────
    var statusBar = document.createElement('div');
    statusBar.className = 'pyodide-status-bar';

    var statusText = document.createElement('span');
    statusText.className = 'pyodide-status-text';

    var timingSpan = document.createElement('span');
    timingSpan.className = 'pyodide-timing';

    statusBar.appendChild(statusText);
    statusBar.appendChild(timingSpan);

    // ── Output area ──────────────────────────────────────────────────────────
    var outputArea = document.createElement('div');
    outputArea.className = 'pyodide-output';
    outputArea.setAttribute('aria-live', 'polite');
    outputArea.hidden = true;

    // ── Assemble ─────────────────────────────────────────────────────────────
    wrapper.appendChild(header);
    wrapper.appendChild(editorContainer);
    wrapper.appendChild(statusBar);
    wrapper.appendChild(outputArea);

    // ── Insert wrapper AFTER placeholder, hide placeholder ───────────────────
    // We do NOT use replaceWith. Hiding the original and inserting a sibling
    // avoids conflicts with React hydration: the original node stays in the
    // DOM tree where React expects it.
    placeholder.style.display = 'none';
    placeholder.parentNode.insertBefore(wrapper, placeholder.nextSibling);

    // ── Initialise CodeMirror 5 ──────────────────────────────────────────────
    var cm = null;
    if (typeof CodeMirror !== 'undefined') {
      try {
        cm = CodeMirror.fromTextArea(textarea, {
          mode: 'python',
          theme: 'pyodide-theme',
          lineNumbers: true,
          indentUnit: 4,
          smartIndent: true,
          matchBrackets: true,
          lineWrapping: false,
          viewportMargin: 20,
          extraKeys: {
            'Shift-Enter': function () { runCode(); },
            'Tab': function (cmInst) {
              if (cmInst.somethingSelected()) {
                cmInst.indentSelection('add');
              } else {
                cmInst.replaceSelection('    ', 'end');
              }
            },
          },
        });
        // Auto-height: grows with content, container CSS handles max-height scroll
        cm.setSize(null, null);
      } catch (err) {
        console.warn('[pyodide-transform] CodeMirror init failed:', err);
        cm = null;
      }
    }

    if (!cm) {
      // CodeMirror not available or failed: fallback to plain <textarea>
      textarea.className = 'pyodide-fallback-textarea';
      textarea.rows = Math.max(4, rawCode.split('\n').length + 1);
      textarea.spellcheck = false;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function getCode() {
      return cm ? cm.getValue() : textarea.value;
    }

    function setStatus(msg, type) {
      statusText.textContent = msg;
      statusText.className = 'pyodide-status-text pyodide-status-' + (type || 'info');
    }

    function setTiming(ms) {
      timingSpan.textContent = ms != null ? (ms + ' ms') : '';
    }

    function renderOutput(result) {
      outputArea.innerHTML = '';
      outputArea.hidden = false;
      var hasContent = false;

      if (result.stdout) {
        hasContent = true;
        var pre1 = document.createElement('pre');
        pre1.className = 'pyodide-stdout';
        pre1.textContent = result.stdout;
        outputArea.appendChild(pre1);
      }

      if (result.stderr) {
        hasContent = true;
        var pre2 = document.createElement('pre');
        pre2.className = 'pyodide-stderr';
        pre2.textContent = result.stderr;
        outputArea.appendChild(pre2);
      }

      if (result.error) {
        hasContent = true;
        var pre3 = document.createElement('pre');
        pre3.className = 'pyodide-error';
        pre3.textContent = result.error;
        outputArea.appendChild(pre3);
      }

      if (result.returnValue && !result.error) {
        hasContent = true;
        var pre4 = document.createElement('pre');
        pre4.className = 'pyodide-return-value';
        pre4.textContent = result.returnValue;
        outputArea.appendChild(pre4);
      }

      var figures = result.figures || [];
      for (var i = 0; i < figures.length; i++) {
        hasContent = true;
        var img = document.createElement('img');
        img.src = figures[i];
        img.className = 'pyodide-figure';
        img.alt = 'matplotlib figure';
        outputArea.appendChild(img);
      }

      if (!hasContent) {
        outputArea.hidden = true;
      }
    }

    function clearOutput() {
      outputArea.innerHTML = '';
      outputArea.hidden = true;
      setStatus('', 'info');
      setTiming(null);
    }

    // ── Run handler ──────────────────────────────────────────────────────────
    function runCode() {
      if (!window.PyodideRunner) {
        setStatus('PyodideRunner not loaded', 'error');
        return;
      }

      runBtn.disabled = true;
      clearOutput();

      // Use an async IIFE so we can await inside
      (async function () {
        // First run: Pyodide may need to initialise
        if (_pyodideLoadState === 'idle') {
          _pyodideLoadState = 'loading';
          setStatus('Loading Pyodide (first run, may take a few seconds)...', 'info');
          try {
            await window.PyodideRunner.load();
            _pyodideLoadState = 'ready';
          } catch (err) {
            _pyodideLoadState = 'error';
            _pyodideLoadError = String(err);
          }
        } else if (_pyodideLoadState === 'loading') {
          setStatus('Waiting for Pyodide...', 'info');
          while (_pyodideLoadState === 'loading') {
            await new Promise(function (r) { setTimeout(r, 200); });
          }
        }

        if (_pyodideLoadState === 'error') {
          setStatus('Failed to load Pyodide: ' + _pyodideLoadError, 'error');
          runBtn.disabled = false;
          return;
        }

        setStatus('Running...', 'info');

        try {
          var result = await window.PyodideRunner.execute(getCode(), wrapper);
          renderOutput(result);
          setTiming(result.durationMs);
          setStatus(
            result.error ? 'Error' : 'Done',
            result.error ? 'error' : 'success'
          );
        } catch (err) {
          setStatus('Error: ' + err, 'error');
        }

        runBtn.disabled = false;
      })();
    }

    // ── Wire buttons ─────────────────────────────────────────────────────────
    runBtn.addEventListener('click', runCode);
    clearBtn.addEventListener('click', clearOutput);
  }

  // ── Find and transform all un-transformed cells ────────────────────────────
  function transformAllCells() {
    var cells = document.querySelectorAll('div.pyodide-cell');
    for (var i = 0; i < cells.length; i++) {
      try {
        buildCell(cells[i]);
      } catch (err) {
        console.error('[pyodide-transform] Error building cell:', err);
      }
    }
  }

  // ── MutationObserver: handle SPA navigation (React re-renders) ─────────────
  // When the user navigates between pages in the Remix app, React replaces the
  // article content. The observer detects new pyodide-cell divs and transforms
  // them after a debounce delay.
  var _observerTimer = null;

  function watchForCells() {
    var observer = new MutationObserver(function () {
      clearTimeout(_observerTimer);
      _observerTimer = setTimeout(transformAllCells, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  // Strategy: wait for React hydration to complete before touching the DOM.
  // We use requestIdleCallback (fires when the browser is idle, typically
  // after React finishes hydrating) with a fallback setTimeout.
  // Then we poll every 500ms for 15 seconds to catch any cells that React
  // may have re-rendered after our initial transform.
  function boot() {
    // Start the MutationObserver immediately (it debounces transforms by 300ms)
    watchForCells();

    function startTransformCycle() {
      transformAllCells();

      // Continue polling to catch React hydration undoing our changes,
      // or lazy-loaded content appearing later.
      var polls = 0;
      var maxPolls = 30; // 30 × 500ms = 15 seconds
      var pollId = setInterval(function () {
        transformAllCells();
        if (++polls >= maxPolls) clearInterval(pollId);
      }, 500);
    }

    // Wait for the browser to be idle (after React hydration settles)
    if (window.requestIdleCallback) {
      window.requestIdleCallback(function () {
        // Extra delay to ensure React hydration is fully complete
        setTimeout(startTransformCycle, 800);
      }, { timeout: 3000 });
    } else {
      setTimeout(startTransformCycle, 2000);
    }
  }

  // Kick off
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
