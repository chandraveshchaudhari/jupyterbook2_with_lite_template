import os
import re
import base64
from uuid import uuid4

PY_BLOCK_RE = re.compile(r"```python_code_block\s*\n(.*?)```", re.DOTALL)

# Minimal GLOBAL LOADER: loads Pyodide and small helper JS/CSS
GLOBAL_LOADER_SOURCE = (
    "<!-- PYODIDE GLOBAL LOADER -->\n"
    "<link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.min.css\">\n"
    "<script src=\"https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js\"></script>\n"
    "<script>window.loadPyodideOnce = (function(){ if(window.pyodideReadyPromise) return window.pyodideReadyPromise; window.pyodideReadyPromise = (async ()=>{ await new Promise(r=>{ if(typeof loadPyodide!=='undefined') r(); else { const s=document.querySelector('script[src*=\"pyodide.js\"]'); if(s) s.onload=r; else r(); }}); if(typeof loadPyodide==='undefined'){ return null; } const py = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/'}); window.pyodide = py; return py; })(); return window.pyodideReadyPromise;})();</script>\n"
)

CELL_INIT_SOURCE = (
    "\n<script>document.addEventListener('DOMContentLoaded',()=>{ if(window.pyodideCellsInitialized) return; window.pyodideCellsInitialized=true; const runAll = async (el)=>{ const py = await window.loadPyodideOnce(); if(!py) return; }; document.querySelectorAll('.py-run').forEach(btn=>{ btn.addEventListener('click', async (e)=>{ const cell = btn.closest('.py-cell'); if(!cell) return; const ta = cell.querySelector('.py-code'); const out = cell.querySelector('.py-out'); out.textContent=''; try{ const py = await window.loadPyodideOnce(); if(!py) { out.textContent='Pyodide not available'; return; } py.setStdout({batched:(s)=>{ out.textContent += s; }}); py.setStderr({batched:(s)=>{ out.textContent += s; }}); const code = ta.value || atob(cell.getAttribute('data-code')||''); await py.runPythonAsync(code); } catch(err){ out.textContent = err.toString(); } }); }); });</script>\n"
)

def build_py_html(code: str):
    encoded = base64.b64encode(code.rstrip().encode('utf-8')).decode('ascii')
    html = (
        f"<div class='py-cell' data-code='{encoded}'>\n"
        f"  <textarea class='py-code' style='display:none'></textarea>\n"
        f"  <div>\n"
        f"    <button class='py-run'>▶ Run</button>\n"
        f"    <button class='py-clear'>Clear</button>\n"
        f"  </div>\n"
        f"  <div class='output-wrapper' style='display:block'><pre class='py-out' style='height:160px;overflow:auto'></pre></div>\n"
        f"</div>"
    )
    return html


def process_markdown_file(path: str):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    matches = list(PY_BLOCK_RE.finditer(text))
    if not matches:
        return False

    new_parts = []
    last = 0
    for m in matches:
        before = text[last:m.start()]
        code = m.group(1)
        if before:
            new_parts.append(before)
        new_parts.append(build_py_html(code))
        last = m.end()
    new_parts.append(text[last:])

    new_text = ''.join(new_parts)

    # Insert global loader after first top-level heading if not present
    if 'PYODIDE GLOBAL LOADER' not in new_text:
        # find first line starting with '#'
        lines = new_text.splitlines(True)
        for i, line in enumerate(lines):
            if line.lstrip().startswith('#'):
                lines.insert(i+1, GLOBAL_LOADER_SOURCE + '\n')
                break
        new_text = ''.join(lines)

    # Append cell init if not present
    if 'pyodideCellsInitialized' not in new_text:
        new_text = new_text + '\n' + CELL_INIT_SOURCE

    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_text)

    return True


def process_all(root_dir: str):
    converted = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # skip build folders
        if '_build' in dirpath.split(os.sep):
            continue
        for fn in filenames:
            if fn.endswith('.md'):
                p = os.path.join(dirpath, fn)
                try:
                    changed = process_markdown_file(p)
                    if changed:
                        converted.append(p)
                except Exception as e:
                    print(f"Error processing {p}: {e}")
    return converted


def setup(app):
    # Sphinx extension entry point
    def on_builder_inited(app):
        root = app.srcdir
        print(f"[myst_code_to_pyodide] scanning {root} for python_code_block fences...")
        converted = process_all(root)
        if converted:
            print(f"[myst_code_to_pyodide] converted {len(converted)} files:")
            for p in converted:
                print(f"  - {p}")

    app.connect('builder-inited', on_builder_inited)
    return {
        'version': '0.1',
        'parallel_read_safe': True,
        'parallel_write_safe': True,
    }
