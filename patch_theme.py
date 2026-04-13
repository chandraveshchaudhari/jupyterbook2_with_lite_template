#!/usr/bin/env python3
"""
patch_theme.py — Replace the stock MyST book-theme build with our custom-rebuilt
version that includes the PyodideCell React component, and copy static assets
(CodeMirror, Pyodide runner/transform, CSS) to the theme's public directory.

The custom theme was built with `npx remix build` from the modified source at
templates/site/myst/book-theme/themes/book/ which includes:
  - PyodideCell.tsx React component (renders pyodide-cell directives natively)
  - root.tsx with <head> CSS/script injections (no fragile regex patching needed)

Run this after `jupyter-book build --site` (i.e. when the stock theme is
extracted to _build/templates/site/myst/book-theme/).

Usage:
    python patch_theme.py
"""

import os
import shutil
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
THEME_DIR = os.path.join(
    PROJECT_ROOT, "_build", "templates", "site", "myst", "book-theme"
)
SRC_STATIC = os.path.join(PROJECT_ROOT, "_static")

# Rebuilt theme (from `npx remix build` in themes/book/)
REBUILT_THEME = os.path.join(
    PROJECT_ROOT, "templates", "site", "myst", "book-theme", "themes", "book"
)


def copy_static_assets():
    """Copy _static/ tree into the theme's public/_static/ directory."""
    public_static = os.path.join(THEME_DIR, "public", "_static")
    if not os.path.isdir(SRC_STATIC):
        print(f"ERROR: Source directory not found: {SRC_STATIC}")
        sys.exit(1)

    dirs_to_copy = ["codemirror"]
    files_to_copy = ["pyodide-runner.js", "pyodide-transform.js", "pyodide.css"]

    os.makedirs(public_static, exist_ok=True)

    for fname in files_to_copy:
        src = os.path.join(SRC_STATIC, fname)
        dst = os.path.join(public_static, fname)
        if os.path.isfile(src):
            shutil.copy2(src, dst)
            print(f"  Copied {fname}")
        else:
            print(f"  WARNING: {src} not found")

    for dname in dirs_to_copy:
        src_dir = os.path.join(SRC_STATIC, dname)
        dst_dir = os.path.join(public_static, dname)
        if os.path.isdir(src_dir):
            os.makedirs(dst_dir, exist_ok=True)
            for fname in os.listdir(src_dir):
                src = os.path.join(src_dir, fname)
                dst = os.path.join(dst_dir, fname)
                if os.path.isfile(src):
                    shutil.copy2(src, dst)
                    print(f"  Copied {dname}/{fname}")
        else:
            print(f"  WARNING: {src_dir} not found")


def replace_theme_build():
    """Replace the extracted stock theme's build with our custom-rebuilt version.

    This copies:
      - build/index.js  (Remix server bundle with PyodideCell component)
      - public/build/    (Remix client bundles with PyodideCell component)
    """
    src_server = os.path.join(REBUILT_THEME, "build", "index.js")
    dst_server = os.path.join(THEME_DIR, "build", "index.js")

    src_public_build = os.path.join(REBUILT_THEME, "public", "build")
    dst_public_build = os.path.join(THEME_DIR, "public", "build")

    if not os.path.isfile(src_server):
        print(f"ERROR: Rebuilt server bundle not found: {src_server}")
        print("       Run `cd templates/site/myst/book-theme/themes/book && npx remix build` first.")
        sys.exit(1)

    # Replace server bundle
    os.makedirs(os.path.dirname(dst_server), exist_ok=True)
    shutil.copy2(src_server, dst_server)
    print(f"  Copied build/index.js (server bundle)")

    # Replace client bundles (clear old, copy new)
    if os.path.isdir(dst_public_build):
        shutil.rmtree(dst_public_build)
    shutil.copytree(src_public_build, dst_public_build)
    n_files = sum(len(files) for _, _, files in os.walk(dst_public_build))
    print(f"  Copied public/build/ ({n_files} files, client bundles)")


def main():
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Theme dir:    {THEME_DIR}")
    print()

    if not os.path.isdir(THEME_DIR):
        print("ERROR: Theme directory not found.")
        print("       Run `jupyter-book build --site` to download the theme first.")
        sys.exit(1)

    print("Step 1: Replacing theme build with custom PyodideCell version...")
    replace_theme_build()
    print()

    print("Step 2: Copying static assets to theme public directory...")
    copy_static_assets()
    print()

    print("Done! The theme now includes the PyodideCell React component.")


if __name__ == "__main__":
    main()
