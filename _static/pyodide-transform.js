/*
  pyodide-transform.js
  - Runtime DOM transformer for MyST v2 static HTML
  - Converts fenced code blocks tagged with `python_code_block` into interactive Pyodide cells.
  - Supports optional `id="..."` metadata.
*/
(function(){
  'use strict';

  function parseMeta(codeEl){
    return codeEl.getAttribute('data-meta') || codeEl.getAttribute('meta') || codeEl.getAttribute('aria-label') || '';
  }

  function extractId(meta){
    const match = meta.match(/\bid\s*=\s*"(.*?)"/);
    if(match) return match[1];
    const matchSingle = meta.match(/\bid\s*=\s*'(.*?)'/);
    return matchSingle ? matchSingle[1] : null;
  }

  function isTargetCode(codeEl){
    const classNames = (codeEl.className || '').split(/\s+/);
    const meta = parseMeta(codeEl);
    return classNames.includes('python_code_block') || meta.indexOf('python_code_block') !== -1;
  }

  function createCellNode(codeText, id){
    const wrapper = document.createElement('div');
    wrapper.className = 'pyodide-cell';
    if(id) wrapper.setAttribute('data-py-id', id);

    wrapper.innerHTML = `
      <div class="pyodide-cell-toolbar">
        <div class="pyodide-actions">
          <button class="py-run" type="button" title="Run"><span aria-hidden="true">▶</span></button>
          <button class="py-clear" type="button" title="Clear output">✖</button>
          <button class="py-copy" type="button" title="Copy code">⧉</button>
        </div>
        <div class="pyodide-meta">
          <span class="pyodide-spinner" aria-hidden="true"></span>
          <span class="pyodide-status"></span>
          <span class="pyodide-time" aria-live="polite"></span>
        </div>
      </div>
      <div class="pyodide-editor-wrapper">
        <textarea class="pyodide-editor" spellcheck="false"></textarea>
      </div>
      <div class="pyodide-output" aria-live="polite">
        <div class="pyodide-output-inner"></div>
      </div>
    `;

    const textarea = wrapper.querySelector('.pyodide-editor');
    textarea.value = codeText.replace(/^\n+|\n+$/g, '');
    return wrapper;
  }

  function hydrate(){
    const codeEls = Array.from(document.querySelectorAll('pre > code'));
    const matches = codeEls.filter(isTargetCode);
    if(matches.length === 0) return;

    matches.forEach((codeEl, idx) => {
      const pre = codeEl.parentElement;
      const meta = parseMeta(codeEl) || '';
      const identifier = extractId(meta) || `py-${Date.now()}-${idx}`;
      const text = codeEl.textContent || '';
      const cellNode = createCellNode(text, identifier);
      pre.replaceWith(cellNode);
    });

    if(window.pyodideRunner && typeof window.pyodideRunner.init === 'function'){
      window.pyodideRunner.init();
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
