/**
 * pyodide-transform.js
 *
 * Finds all <div class="pyodide-cell"> elements rendered by the MyST plugin.
 * Each div contains a <pre><code> block with the Python source. This script
 * replaces those divs with fully interactive UI:
 *   - CodeMirror 5 editor (editable, syntax-highlighted)
 *   - Run button  |  Clear button  (per cell)
 *   - Rocket launcher toolbar (page-level: Restart Kernel, Try Jupyter, Colab)
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
 *   6. Appends the rocket toolbar to document.body so React cannot remove it
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
    var codeEl = el.querySelector('pre code') || el.querySelector('code');
    var rawCode = codeEl ? codeEl.textContent : '';
    var cellId = el.id || ('cell-' + (++_cellIndex));
    return { rawCode: rawCode, cellId: cellId };
  }

  // ── Helper: extract source file path from "Edit This Page" link ────────────
  function getSourceInfo() {
    var editLink = document.querySelector('a[href*="/edit/"]');
    if (!editLink) return null;
    var match = editLink.href.match(/github\.com\/([^\/]+)\/([^\/]+)\/edit\/([^\/]+)\/(.+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], branch: match[3], path: match[4] };
  }

  // ── Helper: get site base path (handles GitHub Pages /{repo}/ prefix) ──────
  function getSiteBase() {
    var hostname = window.location.hostname;
    if (hostname.endsWith('.github.io')) {
      var parts = window.location.pathname.split('/').filter(Boolean);
      return parts.length > 0 ? '/' + parts[0] : '';
    }
    return ''; // custom domain — no base path
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ROCKET TOOLBAR — page-level floating launcher (Restart, Try Jupyter, Colab)
  // ══════════════════════════════════════════════════════════════════════════════
  var _rocketId = 'pyodide-rocket-toolbar';

  function buildRocketToolbar() {
    // Don't duplicate — just toggle visibility
    var existing = document.getElementById(_rocketId);
    if (existing) {
      var hasCells = document.querySelectorAll('div.pyodide-cell').length > 0;
      existing.style.display = hasCells ? '' : 'none';
      return;
    }

    var rocket = document.createElement('div');
    rocket.id = _rocketId;
    rocket.className = 'pyodide-rocket not-prose';

    // Main button
    var rocketBtn = document.createElement('button');
    rocketBtn.type = 'button';
    rocketBtn.className = 'pyodide-rocket-btn';
    rocketBtn.title = 'Launch options';
    rocketBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>' +
      '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' +
      '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>' +
      '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>';

    // Dropdown menu
    var menu = document.createElement('div');
    menu.className = 'pyodide-rocket-menu';
    menu.hidden = true;

    // 1) Restart Kernel
    var restartItem = document.createElement('button');
    restartItem.type = 'button';
    restartItem.className = 'pyodide-rocket-item';
    restartItem.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5h-1.5A5 5 0 1 1 8 3V1.5z"/><path d="M8 0l3 3-3 3V0z"/></svg>' +
      '<span>Restart Kernel</span>';

    // 2) Try Jupyter
    var jupyterItem = document.createElement('a');
    jupyterItem.className = 'pyodide-rocket-item';
    jupyterItem.target = '_blank';
    jupyterItem.rel = 'noopener';
    jupyterItem.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h5.793a1 1 0 0 1 .707.293l2.707 2.707a1 1 0 0 1 .293.707V13.5A2.5 2.5 0 0 1 11.5 16h-7A2.5 2.5 0 0 1 2 13.5v-11zm2.5-1A1.5 1.5 0 0 0 3 3v10.5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5V4l-2.5-2.5H4.5z"/></svg>' +
      '<span>Try Jupyter</span>';

    // 3) Google Colab
    var colabItem = document.createElement('a');
    colabItem.className = 'pyodide-rocket-item';
    colabItem.target = '_blank';
    colabItem.rel = 'noopener';
    colabItem.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4.54 9.46a8.015 8.015 0 0 1 7.46-5.04c3.08 0 5.74 1.73 7.09 4.28l-2.6 1.5A5.5 5.5 0 0 0 12 7.42a5.52 5.52 0 0 0-5.14 3.47L4.54 9.46zm14.92 0l-2.3 1.33a5.52 5.52 0 0 1 .04 5.42l2.3 1.33A8.015 8.015 0 0 0 20 12c0-0.88-.14-1.73-.41-2.54h-.13zM12 17.58a5.52 5.52 0 0 1-4.76-2.74L4.94 16.2a8.015 8.015 0 0 0 7.06 4.22c2.02 0 3.87-.75 5.28-1.98l-2.13-1.64A5.48 5.48 0 0 1 12 17.58z"/></svg>' +
      '<span>Google Colab</span>';

    // Set URLs based on source file
    function updateLinks() {
      var info = getSourceInfo();
      var siteBase = getSiteBase();
      var liteLabUrl = siteBase + '/jupyterlite/lab/index.html';

      if (info && info.path.endsWith('.ipynb')) {
        // Strip leading "notebooks/" since JupyterLite contents are built from that dir
        var litePath = info.path.replace(/^notebooks\//, '');
        jupyterItem.href = liteLabUrl + '?path=' + encodeURIComponent(litePath);
        colabItem.href = 'https://colab.research.google.com/github/' + info.owner + '/' + info.repo + '/blob/' + info.branch + '/' + info.path;
      } else {
        jupyterItem.href = liteLabUrl;
        colabItem.href = 'https://colab.research.google.com/#create=true&language=python';
      }
    }
    updateLinks();

    // Restart handler
    restartItem.addEventListener('click', function () {
      if (!window.PyodideRunner) return;
      restartItem.disabled = true;
      menu.hidden = true;

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
        restartItem.disabled = false;
      })();
    });

    // Toggle menu
    rocketBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      if (!menu.hidden) updateLinks();
    });

    // Close menu on outside click
    document.addEventListener('click', function () { menu.hidden = true; });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });

    menu.appendChild(restartItem);
    menu.appendChild(jupyterItem);
    menu.appendChild(colabItem);
    rocket.appendChild(rocketBtn);
    rocket.appendChild(menu);

    document.body.appendChild(rocket);
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

    controls.appendChild(runBtn);
    controls.appendChild(clearBtn);
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

  // ── Transform all un-transformed cells ─────────────────────────────────────
  function transformAllCells() {
    var cells = document.querySelectorAll('div.pyodide-cell');
    for (var i = 0; i < cells.length; i++) {
      try { buildCell(cells[i]); } catch (err) {
        console.error('[pyodide-transform] Error building cell:', err);
      }
    }
    buildRocketToolbar();
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
    watchForCells();

    function startTransformCycle() {
      transformAllCells();
      var polls = 0;
      var maxPolls = 30;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
