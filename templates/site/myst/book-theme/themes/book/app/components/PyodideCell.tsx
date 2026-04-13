/**
 * PyodideCell.tsx — React component for interactive Pyodide cells.
 *
 * Replaces the old DOM-mutation approach. This component is registered as a
 * custom renderer for `div[class=pyodide-cell]` AST nodes, so it lives inside
 * React's tree from the first paint. No hydration mismatch, no scatter.
 *
 * On the server (SSR) and initial client render: shows an empty container
 * with a CSS loading indicator (::before pseudo-element).
 *
 * After hydration: useEffect calls `window.__initPyodideCell()` (provided by
 * pyodide-transform.js) which populates the container with CodeMirror editor,
 * Run/Clear buttons, output area, etc.
 */
import * as React from 'react';
import type { NodeRenderer } from '@myst-theme/providers';

declare global {
  interface Window {
    __initPyodideCell?: (container: HTMLElement, code: string, cellId: string) => void;
  }
}

export const PyodideCellRenderer: NodeRenderer = ({ node }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const codeNode = node.children?.find((c: any) => c.type === 'code');
  const code = codeNode?.value || '';
  const cellId = node.identifier || node.html_id || '';

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !code.trim()) return;

    // The init function is provided by pyodide-transform.js (loaded via <script defer>).
    // It might not be available yet on first render, so poll briefly.
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const tryInit = () => {
      if (window.__initPyodideCell) {
        window.__initPyodideCell(el, code, cellId);
        return true;
      }
      return false;
    };

    if (!tryInit()) {
      intervalId = setInterval(() => {
        if (tryInit() && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [code, cellId]);

  // Render a minimal container. CSS ::before shows a loading indicator when empty.
  // After useEffect, pyodide-transform.js populates it with the interactive UI.
  // React doesn't manage the inner content (same pattern as @myst-theme/anywidget).
  return (
    <div
      className="pyodide-cell-react not-prose col-body"
      id={cellId ? `pycell-${cellId}` : undefined}
      ref={ref}
      role="region"
      aria-label="Interactive Python cell"
    />
  );
};
