import os
import nbformat
import yaml

# JupyterBook v2: TOC is defined in myst.yml at the project root under project.toc
# Run this script from the repository root: python extensions/auto_notebook_creation_using_toc.py
MYST_FILE = "myst.yml"

# Where to create notebooks (relative to repo root)
OUTPUT_DIR = "."

# Template notebook content
def make_notebook(title):
    nb = nbformat.v4.new_notebook()
    nb["cells"] = [
        nbformat.v4.new_markdown_cell(f"# {title}"),
        nbformat.v4.new_code_cell("# Your code here")
    ]
    return nb

def create_notebook(path, title):
    """Create an .ipynb file if it doesn't exist."""
    if not path.endswith(".ipynb"):
        path += ".ipynb"
    full_path = os.path.join(OUTPUT_DIR, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    if not os.path.exists(full_path):
        nb = make_notebook(title)
        with open(full_path, "w", encoding="utf-8") as f:
            nbformat.write(nb, f)
        print(f"Created: {full_path}")
    else:
        print(f"Exists:  {full_path}")

def process_entry(entry):
    """Recursively process myst.yml toc entries.

    JupyterBook v2 (MyST) toc structure:
      - file: path/to/page          # leaf page
      - title: Section Title        # section with children
        children:
          - file: path/to/child
    """
    if isinstance(entry, dict):
        if "file" in entry:
            title = entry.get("title", entry["file"])
            create_notebook(entry["file"], title)
        # Walk children (nested sections)
        for child in entry.get("children", []):  # 'children' is the MyST v2 key
            process_entry(child)
    elif isinstance(entry, list):
        for e in entry:
            process_entry(e)

def main():
    with open(MYST_FILE, "r", encoding="utf-8") as f:
        myst = yaml.safe_load(f)

    toc = myst.get("project", {}).get("toc", [])
    if not toc:
        print("No 'project.toc' found in myst.yml. Nothing to create.")
        return

    process_entry(toc)

if __name__ == "__main__":
    main()
