/**
 * pyodide-transform.js
 *
 * Provides interactive Pyodide cells with CodeMirror editor, Run/Clear/Run All/
 * Restart buttons, scrollable output, and execution timing.
 *
 * PRIMARY path (React component): The book-theme registers a PyodideCellRenderer
 * React component for `div[class=pyodide-cell]` AST nodes. That component renders
 * an empty container and calls `window.__initPyodideCell(el, code, cellId)` from
 * useEffect. This avoids any React hydration conflicts.
 *
 * FALLBACK path (DOM mutation): For any `div.pyodide-cell` elements that weren't
 * handled by the React component (e.g. raw HTML pages), this script also runs
 * the old polling-based transform as a safety net.
 */

(function () {
  'use strict';

  // ── Cell counter for stable IDs ────────────────────────────────────────────
  var _cellIndex = 0;

  // Store CodeMirror instances so we can refresh them on theme changes
  window._pyodideCodeMirrors = window._pyodideCodeMirrors || [];
  // ── Pyodide loading state (shared across all cells) ────────────────────────
  var _pyodideLoadState = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
  var _pyodideLoadError = null;

  // ── Extract code and id from a pyodide-cell div ────────────────────────────
  function extractCellData(el) {
    var codeEl = el.querySelector('pre code') || el.querySelector('code');
    var rawCode = codeEl ? codeEl.textContent : '';
    var cellId = el.id || ('cell-' + (++_cellIndex));
    return { rawCode: rawCode, cellId: cellId };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SHARED ACTIONS — Restart Kernel + Run All Cells
  // ══════════════════════════════════════════════════════════════════════════════

  function restartKernel() {
    if (!window.PyodideRunner) return;

    var allWrappers = document.querySelectorAll('.pyodide-wrapper');
    for (var w = 0; w < allWrappers.length; w++) {
      var out = allWrappers[w].querySelector('.pyodide-output');
      if (out) { out.innerHTML = ''; out.hidden = true; }
      var sb = allWrappers[w].querySelector('.pyodide-status-text');
      if (sb) sb.textContent = '';
      var tm = allWrappers[w].querySelector('.pyodide-timing');
      if (tm) tm.textContent = '';
    }

    var firstStatus = document.querySelector('.pyodide-wrapper .pyodide-status-text');
    if (firstStatus) {
      firstStatus.textContent = 'Restarting kernel\u2026';
      firstStatus.className = 'pyodide-status-text pyodide-status-info';
    }

    // Disable all restart buttons during restart
    var allRestartBtns = document.querySelectorAll('.pyodide-btn-restart');
    for (var rb = 0; rb < allRestartBtns.length; rb++) allRestartBtns[rb].disabled = true;

    (async function () {
      try {
        await window.PyodideRunner.restart();
        _pyodideLoadState = 'ready';
        if (firstStatus) {
          firstStatus.textContent = 'Kernel restarted';
          firstStatus.className = 'pyodide-status-text pyodide-status-success';
        }
      } catch (err) {
        _pyodideLoadState = 'error';
        _pyodideLoadError = String(err);
        if (firstStatus) {
          firstStatus.textContent = 'Restart failed: ' + err;
          firstStatus.className = 'pyodide-status-text pyodide-status-error';
        }
      }
      for (var rb2 = 0; rb2 < allRestartBtns.length; rb2++) allRestartBtns[rb2].disabled = false;
    })();
  }

  function runAllCells() {
    // Collect all Run buttons in document order and click them sequentially
    var allRunBtns = document.querySelectorAll('.pyodide-btn-run');
    if (allRunBtns.length === 0) return;

    // Disable all Run All buttons during execution
    var allRunAllBtns = document.querySelectorAll('.pyodide-btn-runall');
    for (var ra = 0; ra < allRunAllBtns.length; ra++) allRunAllBtns[ra].disabled = true;

    (async function () {
      for (var i = 0; i < allRunBtns.length; i++) {
        var btn = allRunBtns[i];
        if (btn.disabled) {
          // Wait for a currently-running cell to finish
          while (btn.disabled) {
            await new Promise(function (r) { setTimeout(r, 200); });
          }
        }
        btn.click();
        // Wait for this cell to finish (btn becomes disabled during run, then re-enabled)
        await new Promise(function (r) { setTimeout(r, 100); });
        while (btn.disabled) {
          await new Promise(function (r) { setTimeout(r, 200); });
        }
      }
      for (var ra2 = 0; ra2 < allRunAllBtns.length; ra2++) allRunAllBtns[ra2].disabled = false;
    })();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CELL BUILDER
  // ══════════════════════════════════════════════════════════════════════════════
  function buildCell(placeholder) {
    // Guard: if already transformed, verify our wrapper survived React hydration.
    // React hydration can remove the wrapper sibling while keeping the data attribute,
    // which causes buildCell to skip and leaves raw code visible ("scatter").
    if (placeholder.dataset.pyodideTransformed === 'done') {
      var checkId = placeholder.id;
      if (checkId) {
        var expectedWrapper = document.getElementById('pycell-' + checkId);
        if (expectedWrapper) return; // wrapper intact — skip
      } else {
        return; // no stable ID to verify — assume OK
      }
      // Wrapper was destroyed by React hydration — reset for re-transform
      placeholder.removeAttribute('data-pyodide-transformed');
      placeholder.style.display = '';
    }

    var data = extractCellData(placeholder);
    var rawCode = data.rawCode;
    var cellId = data.cellId;

    if (!rawCode.trim()) return;

    placeholder.dataset.pyodideTransformed = 'done';

    var uid = 'pycell-' + cellId;
    var stale = document.getElementById(uid);
    if (stale) stale.remove();

    var wrapper = document.createElement('div');
    wrapper.className = 'pyodide-wrapper not-prose col-body';
    wrapper.id = uid;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Interactive Python cell');

    var header = document.createElement('div');
    header.className = 'pyodide-header';

    var badge = document.createElement('span');
    badge.className = 'pyodide-lang-badge';
    badge.textContent = 'Python';

    var controls = document.createElement('div');
    controls.className = 'pyodide-controls';

    var runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'pyodide-btn pyodide-btn-run';
    runBtn.title = 'Run (Shift+Enter)';
    runBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
      '<path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg> Run';

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'pyodide-btn pyodide-btn-clear';
    clearBtn.title = 'Clear output';
    clearBtn.textContent = 'Clear';

    var runAllBtn = document.createElement('button');
    runAllBtn.type = 'button';
    runAllBtn.className = 'pyodide-btn pyodide-btn-runall';
    runAllBtn.title = 'Run all cells on this page';
    runAllBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
      '<path d="M1 3.5l5 3-5 3V3.5z"/><path d="M7 3.5l5 3-5 3V3.5z"/></svg> Run All';

    var restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'pyodide-btn pyodide-btn-restart';
    restartBtn.title = 'Restart Pyodide kernel';
    restartBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
      '<path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5h-1.5A5 5 0 1 1 8 3V1.5z"/>' +
      '<path d="M8 0l3 3-3 3V0z"/></svg> Restart';

    runAllBtn.addEventListener('click', runAllCells);
    restartBtn.addEventListener('click', restartKernel);

    controls.appendChild(runBtn);
    controls.appendChild(clearBtn);
    controls.appendChild(runAllBtn);
    controls.appendChild(restartBtn);
    header.appendChild(badge);
    header.appendChild(controls);

    var editorContainer = document.createElement('div');
    editorContainer.className = 'pyodide-editor-container';

    var textarea = document.createElement('textarea');
    textarea.value = rawCode;
    textarea.setAttribute('aria-label', 'Python code editor');
    editorContainer.appendChild(textarea);

    var statusBar = document.createElement('div');
    statusBar.className = 'pyodide-status-bar';

    var statusText = document.createElement('span');
    statusText.className = 'pyodide-status-text';

    var timingSpan = document.createElement('span');
    timingSpan.className = 'pyodide-timing';

    statusBar.appendChild(statusText);
    statusBar.appendChild(timingSpan);

    var outputArea = document.createElement('div');
    outputArea.className = 'pyodide-output';
    outputArea.setAttribute('aria-live', 'polite');
    outputArea.hidden = true;

    wrapper.appendChild(header);
    wrapper.appendChild(editorContainer);
    wrapper.appendChild(statusBar);
    wrapper.appendChild(outputArea);

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
        cm.setSize(null, null);
        // register instance for theme-refresh handling
        try { window._pyodideCodeMirrors.push(cm); } catch (e) { /* noop */ }
      } catch (err) {
        console.warn('[pyodide-transform] CodeMirror init failed:', err);
        cm = null;
      }
    }

    if (!cm) {
      textarea.className = 'pyodide-fallback-textarea';
      textarea.rows = Math.max(4, rawCode.split('\n').length + 1);
      textarea.spellcheck = false;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function getCode() { return cm ? cm.getValue() : textarea.value; }

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
      if (!hasContent) { outputArea.hidden = true; }
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

      (async function () {
        if (_pyodideLoadState === 'idle') {
          _pyodideLoadState = 'loading';
          setStatus('Loading Pyodide (first run, may take a few seconds)\u2026', 'info');
          try {
            await window.PyodideRunner.load();
            _pyodideLoadState = 'ready';
          } catch (err) {
            _pyodideLoadState = 'error';
            _pyodideLoadError = String(err);
          }
        } else if (_pyodideLoadState === 'loading') {
          setStatus('Waiting for Pyodide\u2026', 'info');
          while (_pyodideLoadState === 'loading') {
            await new Promise(function (r) { setTimeout(r, 200); });
          }
        }

        if (_pyodideLoadState === 'error') {
          setStatus('Failed to load Pyodide: ' + _pyodideLoadError, 'error');
          runBtn.disabled = false;
          return;
        }

        setStatus('Running\u2026', 'info');

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

    runBtn.addEventListener('click', runCode);
    clearBtn.addEventListener('click', clearOutput);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PUBLIC API — called by PyodideCellRenderer React component via useEffect
  // ══════════════════════════════════════════════════════════════════════════════
  /**
   * Initialize an interactive Pyodide cell inside the given container element.
   * Called by the React component after hydration — no DOM conflicts possible.
   *
   * @param {HTMLElement} container - Empty div to populate (React component's ref)
   * @param {string} code - Python source code
   * @param {string} cellId - Unique cell identifier
   */
  function initPyodideCell(container, code, cellId) {
    if (!code || !code.trim()) return;
    // Prevent double-init
    if (container.dataset.pyodideInitialized === 'done') return;
    container.dataset.pyodideInitialized = 'done';

    // Add the wrapper class so existing CSS applies
    container.classList.add('pyodide-wrapper');

    var uid = cellId ? ('pycell-' + cellId) : null;
    if (uid && !container.id) container.id = uid;

    var header = document.createElement('div');
    header.className = 'pyodide-header';

    var badge = document.createElement('span');
    badge.className = 'pyodide-lang-badge';
    badge.textContent = 'Python';

    var controls = document.createElement('div');
    controls.className = 'pyodide-controls';

    var runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'pyodide-btn pyodide-btn-run';
    runBtn.title = 'Run (Shift+Enter)';
    runBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
      '<path d="M3 2.5l10 5.5-10 5.5V2.5z"/></svg> Run';

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'pyodide-btn pyodide-btn-clear';
    clearBtn.title = 'Clear output';
    clearBtn.textContent = 'Clear';

    var runAllBtn = document.createElement('button');
    runAllBtn.type = 'button';
    runAllBtn.className = 'pyodide-btn pyodide-btn-runall';
    runAllBtn.title = 'Run all cells on this page';
    runAllBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
      '<path d="M1 3.5l5 3-5 3V3.5z"/><path d="M7 3.5l5 3-5 3V3.5z"/></svg> Run All';

    var restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'pyodide-btn pyodide-btn-restart';
    restartBtn.title = 'Restart Pyodide kernel';
    restartBtn.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">' +
      '<path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5h-1.5A5 5 0 1 1 8 3V1.5z"/>' +
      '<path d="M8 0l3 3-3 3V0z"/></svg> Restart';

    runAllBtn.addEventListener('click', runAllCells);
    restartBtn.addEventListener('click', restartKernel);

    controls.appendChild(runBtn);
    controls.appendChild(clearBtn);
    controls.appendChild(runAllBtn);
    controls.appendChild(restartBtn);
    header.appendChild(badge);
    header.appendChild(controls);

    var editorContainer = document.createElement('div');
    editorContainer.className = 'pyodide-editor-container';

    var textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.setAttribute('aria-label', 'Python code editor');
    editorContainer.appendChild(textarea);

    var statusBar = document.createElement('div');
    statusBar.className = 'pyodide-status-bar';

    var statusText = document.createElement('span');
    statusText.className = 'pyodide-status-text';

    var timingSpan = document.createElement('span');
    timingSpan.className = 'pyodide-timing';

    statusBar.appendChild(statusText);
    statusBar.appendChild(timingSpan);

    var outputArea = document.createElement('div');
    outputArea.className = 'pyodide-output';
    outputArea.setAttribute('aria-live', 'polite');
    outputArea.hidden = true;

    container.appendChild(header);
    container.appendChild(editorContainer);
    container.appendChild(statusBar);
    container.appendChild(outputArea);

    // CodeMirror 5
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
        cm.setSize(null, null);
        // register instance for theme-refresh handling
        try { window._pyodideCodeMirrors.push(cm); } catch (e) { /* noop */ }
      } catch (err) {
        console.warn('[pyodide-transform] CodeMirror init failed:', err);
        cm = null;
      }
    }

    if (!cm) {
      textarea.className = 'pyodide-fallback-textarea';
      textarea.rows = Math.max(4, code.split('\n').length + 1);
      textarea.spellcheck = false;
    }

    function getCode() { return cm ? cm.getValue() : textarea.value; }

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
      if (!hasContent) { outputArea.hidden = true; }
    }

    function clearOutput() {
      outputArea.innerHTML = '';
      outputArea.hidden = true;
      setStatus('', 'info');
      setTiming(null);
    }

    function runCode() {
      if (!window.PyodideRunner) {
        setStatus('PyodideRunner not loaded', 'error');
        return;
      }
      runBtn.disabled = true;
      clearOutput();

      (async function () {
        if (_pyodideLoadState === 'idle') {
          _pyodideLoadState = 'loading';
          setStatus('Loading Pyodide (first run, may take a few seconds)\u2026', 'info');
          try {
            await window.PyodideRunner.load();
            _pyodideLoadState = 'ready';
          } catch (err) {
            _pyodideLoadState = 'error';
            _pyodideLoadError = String(err);
          }
        } else if (_pyodideLoadState === 'loading') {
          setStatus('Waiting for Pyodide\u2026', 'info');
          while (_pyodideLoadState === 'loading') {
            await new Promise(function (r) { setTimeout(r, 200); });
          }
        }

        if (_pyodideLoadState === 'error') {
          setStatus('Failed to load Pyodide: ' + _pyodideLoadError, 'error');
          runBtn.disabled = false;
          return;
        }

        setStatus('Running\u2026', 'info');

        try {
          var result = await window.PyodideRunner.execute(getCode(), container);
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

    runBtn.addEventListener('click', runCode);
    clearBtn.addEventListener('click', clearOutput);

  }

  // Expose as global for the React component
  window.__initPyodideCell = initPyodideCell;

  // ── Transform all un-transformed cells (FALLBACK for non-React pages) ──────
  function transformAllCells() {
    var cells = document.querySelectorAll('div.pyodide-cell');
    for (var i = 0; i < cells.length; i++) {
      try { buildCell(cells[i]); } catch (err) {
        console.error('[pyodide-transform] Error building cell:', err);
      }
    }
  }

  // ── MutationObserver ───────────────────────────────────────────────────────
  var _observerTimer = null;
  function watchForCells() {
    var observer = new MutationObserver(function () {
      clearTimeout(_observerTimer);
      _observerTimer = setTimeout(transformAllCells, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  function boot() {
    // Watch for SPA navigation (new cells appearing)
    watchForCells();

    // Fallback: transform any div.pyodide-cell elements not handled by React
    function startTransformCycle() {
      transformAllCells();
      var polls = 0;
      var maxPolls = 15;
      var pollId = setInterval(function () {
        transformAllCells();
        if (++polls >= maxPolls) clearInterval(pollId);
      }, 500);
    }

    if (window.requestIdleCallback) {
      window.requestIdleCallback(function () {
        setTimeout(startTransformCycle, 200);
      }, { timeout: 2000 });
    } else {
      setTimeout(startTransformCycle, 600);
    }
  }

  // Monitor theme changes on <html> and refresh CodeMirror instances so
  // their styles reflow (this ensures the pyodide-theme CSS under
  // `html.dark` takes effect immediately when user toggles theme).
  (function watchThemeChanges() {
    var root = document.documentElement;
    if (!root || typeof MutationObserver === 'undefined') return;
    var lastClass = root.className;
    var observer = new MutationObserver(function (mutations) {
      var cls = root.className;
      if (cls === lastClass) return;
      lastClass = cls;
      try {
        (window._pyodideCodeMirrors || []).forEach(function (cm) {
          try {
            // reapply theme option and refresh to force redraw
            if (typeof cm.setOption === 'function') cm.setOption('theme', 'pyodide-theme');
            if (typeof cm.refresh === 'function') cm.refresh();
          } catch (e) { /* ignore individual failures */ }
        });
        // Also force a small reflow for elements that rely solely on CSS
        document.querySelectorAll('.pyodide-output, .pyodide-fallback-textarea').forEach(function (el) {
          // toggle a benign class to force repaint
          el.classList.add('pyodide-theme-refresh');
          setTimeout(function () { el.classList.remove('pyodide-theme-refresh'); }, 50);
        });
      } catch (err) {
        console.warn('[pyodide-transform] theme refresh failed', err);
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  })();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
