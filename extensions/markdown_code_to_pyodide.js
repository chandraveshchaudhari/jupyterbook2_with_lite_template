import { visit } from "unist-util-visit";

export default function pythonCodeToPyodide() {
  return (tree) => {
    visit(tree, "code", (node) => {
      if (
        node.lang === "python" &&
        node.meta &&
        node.meta.includes("python_code_block")
      ) {
        const code = node.value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        node.type = "html";
        node.value = `
<div class="pyodide-cell">
  <div class="pyodide-toolbar">
    <button class="pyodide-run">▶ Run</button>
    <button class="pyodide-clear">🧹 Clear</button>
  </div>

  <textarea class="pyodide-input">${code}</textarea>

  <div class="pyodide-output"></div>
</div>
`;
      }
    });
  };
}