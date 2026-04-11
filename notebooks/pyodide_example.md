# Interactive Python Examples

This page demonstrates interactive Pyodide cells using the `pyodide-cell` directive.
Each cell runs Python directly in your browser via Pyodide — no server required.

> **First run:** Pyodide initialises once (~5–10 seconds on first load,
> subsequent cells on the same page run instantly).

---

## Hello, Pyodide

:::{pyodide-cell}
:id: hello

print("Hello from Pyodide!")
x = 6 * 7
print(f"The answer is {x}")
:::

---

## NumPy example

:::{pyodide-cell}
:id: numpy-demo

import numpy as np

a = np.array([1, 2, 3, 4, 5])
print("Array:", a)
print("Mean:", np.mean(a))
print("Std: ", np.std(a))

# Matrix multiplication
m = np.random.rand(3, 3)
print("\nRandom 3×3 matrix:")
print(m)
print("\nDeterminant:", np.linalg.det(m))
:::

---

## Pandas example

:::{pyodide-cell}
:id: pandas-demo

import pandas as pd

data = {
    "City":        ["Delhi", "Mumbai", "Bengaluru", "Chennai"],
    "Population":  [32.9, 20.7, 13.2, 10.9],   # millions
    "Area_km2":    [1484, 603, 741, 426],
}

df = pd.DataFrame(data)
df["Density"] = (df["Population"] * 1e6 / df["Area_km2"]).round(0)
print(df.to_string(index=False))
print(f"\nMost dense: {df.loc[df.Density.idxmax(), 'City']}")
:::

---

## Matplotlib plot

:::{pyodide-cell}
:id: matplotlib-demo

import numpy as np
import matplotlib.pyplot as plt

t = np.linspace(0, 4 * np.pi, 400)

fig, axes = plt.subplots(1, 2, figsize=(9, 3.5))

axes[0].plot(t, np.sin(t), color='steelblue', lw=2, label='sin(t)')
axes[0].plot(t, np.cos(t), color='tomato',    lw=2, label='cos(t)')
axes[0].set_title('Trigonometric functions')
axes[0].legend()
axes[0].grid(alpha=0.3)

axes[1].plot(t, np.exp(-0.2 * t) * np.sin(t * 3),
             color='seagreen', lw=2, label='damped oscillation')
axes[1].set_title('Damped oscillation')
axes[1].legend()
axes[1].grid(alpha=0.3)

plt.tight_layout()
plt.show()
:::

---

## Multi-cell shared state

Cells on the same page **share the same Python kernel**, so variables defined
in one cell are available in later cells.

:::{pyodide-cell}
:id: shared-a

# Run this first
shared_result = [n**2 for n in range(1, 8)]
print("Squares:", shared_result)
:::

:::{pyodide-cell}
:id: shared-b

# Run this second — uses shared_result from the cell above
import numpy as np
arr = np.array(shared_result)
print("Sum of squares:", arr.sum())
print("Root mean square:", np.sqrt(np.mean(arr)))
:::
