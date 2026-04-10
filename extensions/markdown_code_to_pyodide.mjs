import { visit } from "unist-util-visit";

export default function () {
  return (tree) => {
    visit(tree, "code", (node) => {
      if (
        node.lang === "python" &&
        node.meta &&
        node.meta.includes("python_code_block")
      ) {
        const code = node.value
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        node.type = "html";
        node.value = `
<div class="pyodide-cell">
  <button class="pyodide-run">Run</button>
  <textarea class="pyodide-input">${code}</textarea>
  <div class="pyodide-output"></div>
</div>
`;
      }
    });
  };
}
