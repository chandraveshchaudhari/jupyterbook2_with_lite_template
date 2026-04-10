# Section Markdown Page

You can use a `.md` file as a regular Jupyter Book page.

## Why This Matters

- Not every page needs executable cells.
- Markdown pages are lightweight and fast to maintain.
- Great for overview pages, guides, FAQ, and release notes.

## MyST Features Demo

MyST Markdown adds several website-aware enhancements beyond plain markdown.
Use these features in `.md` pages and they will render on the Jupyter Book website.

### Admonitions

::: note
MyST admonitions are a great way to add callouts, tips, warnings, and notes.
:::

::: warning
This warning block is usually visible on the built site but may not appear correctly in simple markdown previews.
:::

### Cross references

You can reference sections, figures, and pages directly from the site.

See [the MyST docs](https://myst-parser.readthedocs.io/) for examples.

### Task lists

- [x] Task one
- [ ] Task two
- [ ] Task three

### Definition list

Term
:  Definition text that explains the term.

### Inline math

Set notation example: $S = \{x \in \mathbb{R} : x^2 > 0\}$

### Code block with syntax highlighting

```python
print('MyST pages can still show code, and code blocks render on the website.')
```

## Visibility Note

> Some MyST-specific features may not render exactly in a plain markdown preview.
> They are designed for the Jupyter Book website and will look correct after site build.

# Interactive Components Showcase

This template demonstrates interactive components supported by **Jupyter Book** and **MyST Markdown**.
These features help create clean, interactive, and user-friendly documentation.

---

## Dropdown Example (Click to Expand / Hide Content)

```{dropdown} Click to learn about Jupyter Book
Jupyter Book is an open-source tool for building beautiful, publication-quality books and websites from computational content.

It supports:

- Jupyter Notebooks
- Markdown
- LaTeX
- Interactive content
- JupyterLite

[Learn more](https://jupyterbook.org)
```

---

## Toggle (Collapsible Dropdown)

```{dropdown} Show / Hide Content

This content appears when clicked.

You can include:

- Text  
- Code  
- Images  
- Plots  
- Tables  

This makes your content cleaner and easier to navigate.
```

---

## Admonition Dropdown (Professional Style)

```{admonition} Template Feature
:class: dropdown

This template supports:

- Interactive notebooks  
- JupyterLite execution  
- GitHub Pages deployment  
- Auto notebook generation  
- Pyodide execution  

These features make it ideal for teaching, research, and documentation.
```

---

## Tabs Example

::::{tab-set}
:::{tab-item} Python
```python
print("Hello from Python")
```
:::

:::{tab-item} Markdown
```markdown
# Hello from Markdown
This content is rendered as markdown on the built website.
```
:::

:::{tab-item} Output
This tab shows output content.
:::
::::

---

## Wikipedia Popup Example

```{dropdown} Learn about Python (Wikipedia Preview)

<iframe 
src="https://en.wikipedia.org/wiki/Python_(programming_language)"
width="100%" 
height="400px">
</iframe>

```

---

## Tooltip Example

This template supports glossary tooltips like {term}`Jupyter Book`.

```{glossary}
Jupyter Book
: An open-source tool for building interactive books and documentation using MyST Markdown.
```

---

## Callout Example

```{note}
This template is designed to showcase interactive learning features.
```

```{warning}
Make sure to enable execution if you want runnable notebooks.
```

```{tip}
Use dropdowns to keep your content clean and organized.
```

<link rel="stylesheet" href="/_static/pyodide.css">
<script src="/_static/pyodide/pyodide.js"></script>
<script src="/_static/codemirror/init-codemirror.js"></script>
<script src="/_static/pyodide-runner.js"></script>
<script src="/_static/pyodide-transform.js"></script>

```python python_code_block
print("Hello Pyodide")
```
