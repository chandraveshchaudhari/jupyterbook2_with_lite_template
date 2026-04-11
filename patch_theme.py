#!/usr/bin/env python3
"""
patch_theme.py — Patch the stock MyST book-theme to inject Pyodide/CodeMirror
scripts and CSS into the <head> of every page, and copy static assets to the
theme's public directory so they are served via Express.

Run this after `myst start` downloads a fresh theme (i.e. when
_build/templates/site/myst/book-theme/ is regenerated).

Usage:
    python patch_theme.py
"""

import os
import re
import shutil
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
THEME_DIR = os.path.join(
    PROJECT_ROOT, "_build", "templates", "site", "myst", "book-theme"
)
BUILD_JS = os.path.join(THEME_DIR, "build", "index.js")
PUBLIC_STATIC = os.path.join(THEME_DIR, "public", "_static")
SRC_STATIC = os.path.join(PROJECT_ROOT, "_static")


def copy_static_assets():
    """Copy _static/ tree into the theme's public/_static/ directory."""
    if not os.path.isdir(SRC_STATIC):
        print(f"ERROR: Source directory not found: {SRC_STATIC}")
        sys.exit(1)

    # Subdirectories to copy
    dirs_to_copy = ["codemirror"]
    files_to_copy = ["pyodide-runner.js", "pyodide-transform.js", "pyodide.css"]

    os.makedirs(PUBLIC_STATIC, exist_ok=True)

    for fname in files_to_copy:
        src = os.path.join(SRC_STATIC, fname)
        dst = os.path.join(PUBLIC_STATIC, fname)
        if os.path.isfile(src):
            shutil.copy2(src, dst)
            print(f"  Copied {fname}")
        else:
            print(f"  WARNING: {src} not found")

    for dname in dirs_to_copy:
        src_dir = os.path.join(SRC_STATIC, dname)
        dst_dir = os.path.join(PUBLIC_STATIC, dname)
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


def patch_build_js():
    """Inject CSS <link> and <script defer> tags into the theme's <head>."""
    if not os.path.isfile(BUILD_JS):
        print(f"ERROR: {BUILD_JS} not found. Run `myst start` first.")
        sys.exit(1)

    with open(BUILD_JS, "r") as f:
        content = f.read()

    # Check if already patched
    if "pyodide-runner" in content:
        print("  build/index.js already patched — skipping.")
        return

    # Find the head-children closing pattern after myst-theme.css link
    pattern = re.search(r'myst-theme\.css`\}\)(\]\}\)),', content)
    if not pattern:
        print("ERROR: Could not find injection point in build/index.js")
        print("       The theme version may have changed. Manual patching needed.")
        sys.exit(1)

    close_pos = content.find("]}),", pattern.start())

    injected = (
        ","
        '(0,K2.jsx)("link",{rel:"stylesheet",href:"/_static/codemirror/codemirror.css"})'
        ","
        '(0,K2.jsx)("link",{rel:"stylesheet",href:"/_static/pyodide.css"})'
        ","
        '(0,K2.jsx)("script",{src:"/_static/codemirror/codemirror.js",defer:true})'
        ","
        '(0,K2.jsx)("script",{src:"/_static/codemirror/python.js",defer:true})'
        ","
        '(0,K2.jsx)("script",{src:"/_static/pyodide-runner.js",defer:true})'
        ","
        '(0,K2.jsx)("script",{src:"/_static/pyodide-transform.js",defer:true})'
    )

    content = content[:close_pos] + injected + content[close_pos:]

    with open(BUILD_JS, "w") as f:
        f.write(content)

    print("  build/index.js patched successfully.")


def main():
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Theme dir:    {THEME_DIR}")
    print()

    if not os.path.isdir(THEME_DIR):
        print("ERROR: Theme directory not found.")
        print("       Run `myst start` once to download the book-theme first.")
        sys.exit(1)

    print("Step 1: Copying static assets to theme public directory...")
    copy_static_assets()
    print()

    print("Step 2: Patching build/index.js to inject <head> tags...")
    patch_build_js()
    print()

    print("Done! Restart `myst start` (without --headless) to pick up changes.")


if __name__ == "__main__":
    main()
