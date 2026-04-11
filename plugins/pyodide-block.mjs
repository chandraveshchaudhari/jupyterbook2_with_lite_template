/**
 * pyodide-block.mjs — MyST v2 JavaScript Plugin
 *
 * Provides a `pyodide-cell` directive that produces a structured div
 * containing a hidden code block. The frontend `pyodide-transform.js`
 * finds these divs at runtime and replaces them with interactive UI.
 *
 * Usage in myst.yml:
 *   project:
 *     plugins:
 *       - plugins/pyodide-block.mjs
 *
 * Markdown usage (directive):
 *   :::{pyodide-cell}
 *   :id: my-cell
 *   print("Hello Pyodide")
 *   :::
 */

/**
 * Directive: creates a div.pyodide-cell wrapping a code block.
 *
 * MyST v2 strips data-* attributes from raw HTML nodes, so we embed
 * the source code as a child `code` node inside the div. The cell ID
 * is stored as the div's `identifier` property.
 *
 * The frontend JS (`pyodide-transform.js`) finds divs with class
 * `pyodide-cell`, extracts code from the child `<pre><code>`, and
 * builds the interactive editor + run button.
 */
const pyodideCellDirective = {
  name: 'pyodide-cell',
  doc: 'Embed an interactive Pyodide Python cell.',
  alias: ['python-cell'],
  arg: { type: String, doc: 'Optional cell ID' },
  options: {
    id: { type: String, doc: 'Unique cell identifier' },
  },
  body: { type: String, doc: 'Python source code' },
  run(data) {
    const cellId =
      data.options?.id ??
      data.arg ??
      `pyodide-${Math.random().toString(36).slice(2, 9)}`;
    const code = data.body ?? '';

    // Return a div containing a code block.
    // The div gets class="pyodide-cell" and the code node carries the source.
    // The identifier field survives as a data attribute or HTML id.
    return [
      {
        type: 'div',
        class: 'pyodide-cell',
        identifier: cellId,
        children: [
          {
            type: 'code',
            lang: 'python',
            value: code,
          },
        ],
      },
    ];
  },
};

const plugin = {
  name: 'Pyodide Interactive Cells',
  directives: [pyodideCellDirective],
};

export default plugin;
