#!/usr/bin/env python3
"""Build a .ankiaddon file from src/ace/.

An .ankiaddon is a plain zip of the add-on folder's *contents* -- manifest.json and
the Python modules sit at the archive root, with no enclosing directory, since Anki
unpacks the archive straight into addons21/<package>/.
"""

import argparse
import json
import subprocess
import sys
import tomllib
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ADDON_DIR = REPO_ROOT / "src" / "ace"
DIST_DIR = REPO_ROOT / "dist"

# Built by `npm run build`; git-ignored, but the add-on is broken without it, so it
# has to be in the archive.
BUNDLE = ADDON_DIR / "web" / "codemirror.js"

EXCLUDED_DIRS = {"__pycache__", ".mypy_cache", ".ruff_cache"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo"}
# Anki writes meta.json itself (enabled/disabled state, version pins); shipping one
# would overwrite the user's.
EXCLUDED_NAMES = {"meta.json", ".DS_Store"}


def build_bundle() -> None:
    print("$ npm run build", flush=True)
    subprocess.run(["npm", "run", "build"], cwd=REPO_ROOT, check=True)


def addon_version() -> str:
    with (REPO_ROOT / "pyproject.toml").open("rb") as pyproject:
        return tomllib.load(pyproject)["project"]["version"]


def read_package_name() -> str:
    manifest_path = ADDON_DIR / "manifest.json"
    if not manifest_path.exists():
        sys.exit(f"error: {manifest_path.relative_to(REPO_ROOT)} is missing")

    manifest = json.loads(manifest_path.read_text())
    package = manifest.get("package")
    if not package:
        sys.exit(f'error: {manifest_path.relative_to(REPO_ROOT)} has no "package" key')
    return package


def files_to_archive() -> list[Path]:
    paths = []
    for path in ADDON_DIR.rglob("*"):
        relative = path.relative_to(ADDON_DIR)
        if EXCLUDED_DIRS.intersection(relative.parts):
            continue
        if not path.is_file():
            continue
        if path.suffix in EXCLUDED_SUFFIXES or path.name in EXCLUDED_NAMES:
            continue
        paths.append(path)
    # Sorted so repeated runs lay the archive out the same way.
    return sorted(paths)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="package the CodeMirror bundle as it is instead of rebuilding it first",
    )
    args = parser.parse_args()

    package = read_package_name()

    if not args.skip_build:
        build_bundle()
    if not BUNDLE.exists():
        sys.exit(
            f"error: {BUNDLE.relative_to(REPO_ROOT)} is missing -- "
            f"run `npm install && npm run build`"
        )

    DIST_DIR.mkdir(exist_ok=True)
    output = DIST_DIR / f"{package}-{addon_version()}.ankiaddon"

    paths = files_to_archive()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            archive.write(path, path.relative_to(ADDON_DIR))

    print(
        f"\n{output.relative_to(REPO_ROOT)} ({len(paths)} files, {output.stat().st_size:,} bytes)"
    )
    for path in paths:
        print(f"  {path.relative_to(ADDON_DIR)}")


if __name__ == "__main__":
    main()
