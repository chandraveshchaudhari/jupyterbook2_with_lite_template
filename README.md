# JupyterBook v2 (MyST) + JupyterLite Template

<p align="center">
	<img src="media/images/banner_image.png" alt="Book banner" width="100%" />
</p>

<p align="center">
	<a href="https://jupyterbook.org/">
		<img alt="Jupyter Book" src="https://img.shields.io/badge/Jupyter%20Book-v2%20MyST-F37626?style=for-the-badge&logo=jupyter&logoColor=white" />
	</a>
	<a href="https://jupyterlite.readthedocs.io/">
		<img alt="JupyterLite" src="https://img.shields.io/badge/JupyterLite-In%20Browser%20Lab-1D9BF0?style=for-the-badge&logo=jupyter&logoColor=white" />
	</a>
	<a href="https://colab.research.google.com/">
		<img alt="Google Colab" src="https://img.shields.io/badge/Google%20Colab-Ready-F9AB00?style=for-the-badge&logo=googlecolab&logoColor=white" />
	</a>
</p>

<p align="center">
	<img alt="GitHub Pages" src="https://img.shields.io/badge/Deploy-GitHub%20Pages-24292F?style=flat-square&logo=github&logoColor=white" />
	<img alt="JupyterLite" src="https://img.shields.io/badge/Runtime-JupyterLite-2C7BE5?style=flat-square&logo=python&logoColor=white" />
	<img alt="MyST" src="https://img.shields.io/badge/Built%20With-MyST%20Markdown-0A507A?style=flat-square&logo=readthedocs&logoColor=white" />
	<img alt="PR Friendly" src="https://img.shields.io/badge/PRs-Welcome-2EA44F?style=flat-square&logo=git&logoColor=white" />
</p>

A ready-to-use template for publishing notebook-based documentation on GitHub Pages using **JupyterBook v2 (MyST)** with native JupyterLite launch buttons.

## Overview

This is a **JupyterBook v2 (MyST)** template with **interactive Pyodide code cells** that run Python entirely in the browser via WebAssembly. No server is required — all code execution happens client-side on GitHub Pages.

**Live site:** <https://chandraveshchaudhari.github.io/jupyterbook2_with_lite_template/>
**Repository:** <https://github.com/chandraveshchaudhari/jupyterbook2_with_lite_template>


## Quick Start

1. Click **Use this template** (or fork this repository).
2. Clone your new repository.
3. Edit **`myst.yml`** — set your title, author name, and GitHub URL.
4. Add content to `notebooks/` and register pages in `myst.yml` under `project.toc`.
5. Push to `main` — GitHub Actions builds and deploys automatically.

## Project Structure

```
myst.yml                   ← All config + table of contents (single source of truth)
intro.md                   ← Landing / home page
requirements.txt           ← Python dependencies
images/                    ← Static assets (project root — NOT inside a subfolder)
  banner_image.png
notebooks/                 ← Content pages (.ipynb and .md)
  adding_contents.ipynb
  features.ipynb
  section_markdown_page.md
extensions/                ← Optional helper script
  auto_notebook_creation_using_toc.py
.github/workflows/         ← GitHub Actions CI/CD
```

## Configuration (`myst.yml`)

```yaml
project:
  title: My Book Title
  authors:
    - name: Your Name
      github: your-github-username
  github: https://github.com/your-username/your-repo
  license:
    code: MIT
    content: CC-BY-4.0

  # Native JupyterLite launch button on every page (no Python scripts needed)
  jupyter:
    lite: true
    # binder:                       # optional Binder button
    #   repo: your-username/your-repo
    #   ref: main

  # Binder badge — shown directly on every page (no dialog)
  binder: https://mybinder.org/v2/gh/your-username/your-repo/HEAD

  banner: images/banner_image.png

  toc:
    - file: intro.md
    - title: Getting Started
      children:
        - file: notebooks/adding_contents.ipynb

site:
  template: book-theme
  options:
    logo: images/banner_image.png
    folders: true
```

## GitHub Deployment (No Local Build Required)

1. Go to `Settings → Actions → General` and allow workflows to run.
2. Go to `Settings → Pages` and set source to `GitHub Actions`.
3. Push to `main`.

Your site: `https://<your-github-username>.github.io/<your-repo-name>/`

## Local Preview (Optional)

```bash
pip install -r requirements.txt
jupyter book start        # live-reload preview at http://localhost:3000
jupyter book build        # static HTML → _build/html/index.html
```

## Launch Buttons

| Button | Where | Config |
|--------|-------|--------|
| ⚡ Power button | In-page JupyterLite execution (Pyodide/WASM kernel) | `project.jupyter.lite: true` |
| 🔵 Binder badge | Direct link to mybinder.org, shown on every page | `project.binder: https://mybinder.org/v2/gh/...` |
| 🟠 Colab badge | Each notebook's first cell (HTML `<img>` link) | Update `href` in each notebook |
| 🚀 Rocket button | Dialog to enter any JupyterHub/BinderHub URL | Always present when `jupyter:` is set |

## Scaffold Notebooks from TOC (Optional)

```bash
python extensions/auto_notebook_creation_using_toc.py
```

Creates empty `.ipynb` files for every entry in `project.toc` of `myst.yml`.
