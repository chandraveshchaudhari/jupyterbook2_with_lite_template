# Pyodide interactive code block

<link rel="stylesheet" href="/_static/pyodide.css">
<script src="/_static/pyodide/pyodide.js"></script>
<script src="/_static/codemirror/init-codemirror.js"></script>
<script src="/_static/pyodide-runner.js"></script>
<script src="/_static/pyodide-transform.js"></script>

This example converts a fenced code block tagged with `python_code_block` into an editable, runnable Pyodide cell.

```python python_code_block id="7xw1qd"
import numpy as np
import pandas as pd

frame = pd.DataFrame(np.arange(9).reshape(3, 3), columns=['A', 'B', 'C'])
print(frame)
```

Edit the code above and click `Run`. Output, errors, and execution time appear below the editor.
