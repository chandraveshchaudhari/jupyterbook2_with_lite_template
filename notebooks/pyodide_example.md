# Pyodide interactive code block

This example converts a fenced code block tagged with `python_code_block` into an editable, runnable Pyodide cell.

```python python_code_block id="7xw1qd"
import numpy as np
import pandas as pd

frame = pd.DataFrame(np.arange(9).reshape(3, 3), columns=['A', 'B', 'C'])
print(frame)
```

Edit the code above and click `Run`. Output, errors, and execution time appear below the editor.
