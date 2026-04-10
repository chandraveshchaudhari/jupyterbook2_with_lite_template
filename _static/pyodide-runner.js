/*
  pyodide-runner.js
  - Loads Pyodide once from local `_static/pyodide/`
  - Preloads packages: numpy, pandas, matplotlib
  - Supports CodeMirror editor initialization when available
  - Provides Run / Clear / Copy / execution timing for each cell
*/
(function(){
  'use strict';

  const INDEX_URL = (function(){
    const script = document.currentScript && document.currentScript.src;
    if(script && script.includes('/_static/')){
      return new URL('../pyodide/', script).href;
    }
    return new URL('./_static/pyodide/', document.baseURI).href;
  })();
  const PRELOAD_PACKAGES = ['numpy','pandas','matplotlib'];
  const MAX_EDITOR_HEIGHT = 420;

  let pyodide = null;
  let readyPromise = null;

  function loadPyodideOnce(){
    if(pyodide) return Promise.resolve(pyodide);
    if(readyPromise) return readyPromise;

    if(typeof loadPyodide !== 'function'){
      return Promise.reject(new Error('Pyodide not found. Ensure _static/pyodide/pyodide.js is included.'));
    }

    readyPromise = loadPyodide({ indexURL: INDEX_URL }).then(async (py) => {
      pyodide = py;
      try{
        await pyodide.loadPackage(PRELOAD_PACKAGES);
      }catch(error){
        console.warn('Failed to preload Pyodide packages:', error);
      }
      return pyodide;
    });

    return readyPromise;
  }

  function detectTheme(){
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return document.documentElement.getAttribute('data-theme') === 'dark' || prefersDark ? 'dark' : 'light';
  }

  function createEditor(textarea){
    if(window.CodeMirror && typeof window.CodeMirror.fromTextArea === 'function'){
      try{
        const cm = window.CodeMirror.fromTextArea(textarea, {
          mode: 'python',
          lineNumbers: true,
          indentUnit: 4,
          theme: detectTheme() === 'dark' ? 'darcula' : 'default',
          viewportMargin: Infinity,
          autoCloseBrackets: true,
          matchBrackets: true,
          extraKeys: { 'Tab': cm => cm.replaceSelection('    ') }
        });
        return {
          cm,
          getValue: () => cm.getValue(),
          setValue: v => cm.setValue(v),
          focus: () => cm.focus(),
          hasCodeMirror: true
        };
      }catch(error){
        console.warn('CodeMirror initialization failed; falling back to textarea.', error);
      }
    }

    textarea.style.whiteSpace = 'pre';
    textarea.style.minHeight = '140px';
    textarea.style.maxHeight = `${MAX_EDITOR_HEIGHT}px`;
    textarea.style.resize = 'vertical';

    return {
      getValue: () => textarea.value,
      setValue: v => { textarea.value = v; },
      focus: () => textarea.focus(),
      hasCodeMirror: false
    };
  }

  function upgradeEditors(){
    if(!window.CodeMirror || typeof window.CodeMirror.fromTextArea !== 'function') return;

    const cells = Array.from(document.querySelectorAll('.pyodide-cell'));
    cells.forEach((cell) => {
      const api = cell._editorAPI;
      if(api && !api.hasCodeMirror){
        const textarea = cell.querySelector('.pyodide-editor');
        if(textarea){
          const code = api.getValue();
          const newApi = createEditor(textarea);
          newApi.setValue(code);
          cell._editorAPI = newApi;
        }
      }
    });
  }

  function escapeHtml(text){
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function clearOutput(outputInner){
    outputInner.innerHTML = '';
  }

  function appendOutput(outputInner, html, className){
    const row = document.createElement('div');
    if(className) row.className = className;
    row.innerHTML = html;
    outputInner.appendChild(row);
    outputInner.parentElement.scrollTop = outputInner.parentElement.scrollHeight;
  }

  async function runCode(cellEl){
    const statusEl = cellEl.querySelector('.pyodide-status');
    const timeEl = cellEl.querySelector('.pyodide-time');
    const spinner = cellEl.querySelector('.pyodide-spinner');
    const outputInner = cellEl.querySelector('.pyodide-output-inner');
    const editorAPI = cellEl._editorAPI;
    const code = editorAPI && typeof editorAPI.getValue === 'function' ? editorAPI.getValue() : '';

    statusEl.textContent = 'Running...';
    spinner.classList.add('running');
    clearOutput(outputInner);
    const start = performance.now();

    try{
      const py = await loadPyodideOnce();
      const stdout = [];
      const stderr = [];

      py.setStdout({ batched: (chunk) => stdout.push(chunk) });
      py.setStderr({ batched: (chunk) => stderr.push(chunk) });

      const result = await py.runPythonAsync(code);

      if(stdout.length){
        appendOutput(outputInner, `<pre class="py-stdout">${escapeHtml(stdout.join(''))}</pre>`, 'py-stdout');
      }
      if(stderr.length){
        appendOutput(outputInner, `<pre class="py-stderr">${escapeHtml(stderr.join(''))}</pre>`, 'py-stderr');
      }
      if(result !== undefined && result !== null){
        appendOutput(outputInner, `<div class="py-result">${escapeHtml(String(result))}</div>`, 'py-result');
      }

      statusEl.textContent = 'Done';
    }catch(error){
      appendOutput(outputInner, `<pre class="py-exception">${escapeHtml(error)}</pre>`, 'py-exception');
      statusEl.textContent = 'Error';
    }finally{
      spinner.classList.remove('running');
      const elapsed = ((performance.now() - start) / 1000).toFixed(2);
      timeEl.textContent = ` ${elapsed}s`;
      if(pyodide){
        pyodide.setStdout();
        pyodide.setStderr();
      }
    }
  }

  function bindCell(cellEl){
    if(cellEl._pyodideCellBound) return;
    const textarea = cellEl.querySelector('.pyodide-editor');
    const editorAPI = createEditor(textarea);
    cellEl._editorAPI = editorAPI;

    if(!editorAPI.hasCodeMirror){
      textarea.style.overflow = 'auto';
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(MAX_EDITOR_HEIGHT, textarea.scrollHeight)}px`;
      });
      textarea.dispatchEvent(new Event('input'));
    }

    const runBtn = cellEl.querySelector('.py-run');
    const clearBtn = cellEl.querySelector('.py-clear');
    const copyBtn = cellEl.querySelector('.py-copy');
    const outputInner = cellEl.querySelector('.pyodide-output-inner');

    runBtn.addEventListener('click', () => runCode(cellEl));
    clearBtn.addEventListener('click', () => clearOutput(outputInner));
    copyBtn.addEventListener('click', () => {
      const value = editorAPI.getValue();
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(value).catch(() => {});
      } else {
        const copyArea = document.createElement('textarea');
        copyArea.value = value;
        document.body.appendChild(copyArea);
        copyArea.select();
        document.execCommand('copy');
        copyArea.remove();
      }
    });

    cellEl._pyodideCellBound = true;
  }

  function initAll(){
    const cells = Array.from(document.querySelectorAll('.pyodide-cell'));
    cells.forEach(bindCell);
  }

  window.pyodideRunner = {
    init: initAll,
    load: loadPyodideOnce,
    runAll: async function(){
      const cells = Array.from(document.querySelectorAll('.pyodide-cell'));
      for(const cell of cells){
        await runCode(cell);
      }
    }
  };

  window.addEventListener('codemirror-loaded', upgradeEditors);
})();
