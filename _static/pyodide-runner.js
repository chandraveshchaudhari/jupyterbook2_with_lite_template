pyodide = await loadPyodide({
  indexURL: "/_static/pyodide/"
});

async function loadPyodideRuntime() {
  if (!pyodideReady) {

    pyodide = await loadPyodide({
      indexURL: "/_static/pyodide/"
    });

    await pyodide.loadPackage([
      "numpy",
      "pandas",
      "matplotlib"
    ]);

    pyodideReady = true;
  }
}