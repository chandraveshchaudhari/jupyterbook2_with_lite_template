# Welcome to the JupyterBook v2 + JupyterLite Template

This template is designed so users can publish quickly with minimal setup using **JupyterBook v2 (MyST)**.


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
	<img alt="Pyodide" src="https://img.shields.io/badge/Runtime-Pyodide-2C7BE5?style=flat-square&logo=python&logoColor=white" />
	<img alt="MyST" src="https://img.shields.io/badge/Built%20With-MyST%20Markdown-0A507A?style=flat-square&logo=readthedocs&logoColor=white" />
	<img alt="PR Friendly" src="https://img.shields.io/badge/PRs-Welcome-2EA44F?style=flat-square&logo=git&logoColor=white" />
</p>

## 1) Create Your Repository

- Click **Use this template** (or fork this repository).
- Create your own repository under your GitHub account.

## 2) Understand Project Structure

JupyterBook v2 uses a single config file at the project root:

- `myst.yml`: **all** project configuration + table of contents
- `intro.md`: landing page of your book
- `images/`: static assets (images, favicon) — at **project root**, not inside `notebooks/`
- `notebooks/`: your content pages (`.ipynb` and `.md`)
- `.github/workflows/`: automated build and deploy to GitHub Pages

## 3) Configure Your Book

Edit **`myst.yml`** at the project root and set:

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
  # Adds a native JupyterLite "Launch" button to every page
  jupyter:
    lite: true
  banner: images/banner_image.png
  toc:
    - file: intro
    - title: Chapter 1
      children:
        - file: notebooks/chapter1
site:
  template: book-theme
  options:
    logo: images/banner_image.png
    folders: true
```

## 4) Deployment Model

This template comes pre-configured with **GitHub Actions** and **GitHub Pages**.
Once enabled, every push to the `main` branch automatically builds and deploys your site.

To enable deployment:

* Go to the **Actions** tab in your GitHub repository and grant permission if prompted
* Go to **Settings → Pages**
* Under **Source**, select **Deploy from workflow**

After pushing your changes, your site will be available at:

`https://<yourusername>.github.io/<your-repo-name>/`

## Nice to know before using the template

- **GitHub Account**: To create and manage your repository.
- **Basic Git**: Know how to clone, commit, and push changes.
- **Markdown / MyST**: Basic syntax for editing content.
- **Python** (optional): For adding code to notebooks or running scripts locally.

---

- **JupyterLite**: Runs notebooks in the browser—no installation required.
- **Google Colab**: Optional for cloud-based execution.

## Optional Local Preview

You can develop fully on GitHub Actions, but local preview is useful for quick checks:

```bash
pip install -r requirements.txt
jupyter book start
```

This starts a live-reloading dev server at `http://localhost:3000`.

To build static HTML instead:

```bash
jupyter book build
```

Then open `_build/html/index.html` in your browser.

---

## Keyboard & UI Tips

| Tip | How |
|---|---|
| **Fullscreen** | Click the 🔵 floating button (bottom-right) or press **F11** |
| **Collapse right outline** | Click the small toggle arrow in the "On this page" header |
| **Run code in-page** | Click the ⚡ power button in the top toolbar to activate JupyterLite |
| **Scrollable output** | Long outputs scroll automatically inside the cell |

```{raw} html
<!-- Fullscreen floating button — available on every page that includes this script -->
<button id="myst-fullscreen-btn" title="Toggle Fullscreen (F11)">⛶</button>
<script>
(function () {
  var btn = document.getElementById('myst-fullscreen-btn');
  if (!btn) return;
  function update() {
    btn.title = document.fullscreenElement ? 'Exit Fullscreen (F11)' : 'Toggle Fullscreen (F11)';
    btn.textContent = document.fullscreenElement ? '\u2715' : '\u26f6';
  }
  btn.addEventListener('click', function () {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen();
    }
  });
  document.addEventListener('fullscreenchange', update);
  update();
})();
</script>
```
