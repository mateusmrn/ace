# ACE — Anki Code Extension

An Anki add-on for practicing code from memory. Instead of grading yourself on a
text answer, you write a solution in a real code editor on the front of the card;
when you reveal the answer, ACE runs both your code and the reference solution and
tells you whether they produced the same output.

## How it works

ACE registers an **"ACE Code"** note type with three fields:

| Field | Purpose |
| --- | --- |
| `Problem Statement` | Shown on both sides of the card. |
| `Reference Code` | The solution. Edited in CodeMirror, shown on the answer side. |
| `Executor Script` | Bash script that runs a piece of code and prints its output. |

The executor script is run twice — once with `$ACE_CODE_FILE` pointing at the
reference code, once pointing at the code you typed — and the two stdouts are
compared. Both runs happen in the same throwaway temp directory with a 5 second
timeout. Alongside `$ACE_CODE_FILE`, the reference run also gets
`$ACE_REFERENCE_CODE_FILE` and the submitted run `$ACE_INPUT_CODE_FILE`, so a
script can tell the two apart when it needs to.

A Python executor script, for example:

```bash
python3 "$ACE_CODE_FILE"
```

The code you type during review is never saved to the note — it is ephemeral,
per-attempt, and lives only long enough to be compared.

In both the note editor and the reviewer, the plain Anki text inputs for code are
replaced by [CodeMirror 6](https://codemirror.net/) editors with the darcula theme.

### Mobile

AnkiDroid and AnkiMobile have no add-on system, so none of this runs there. Cards
degrade to a CSS-only warning suggesting you bury the card and study it on a
desktop.

## Install

Symlink the package into Anki's add-on directory:

```bash
ln -s "$PWD/src/ace" ~/.local/share/Anki2/addons21/ace
```

(On macOS, `~/Library/Application Support/Anki2/addons21/ace`.)

The folder name is up to you — it becomes the add-on's package name, which
`src/ace/paths.py` derives from `__name__` so the webview asset URLs follow along.

## Build

`src/ace/web/codemirror.js` is a build artifact (git-ignored) bundling CodeMirror
onto `window.CodeMirror`. Without it, both webviews fail to load their editors, so
build it before first launching Anki:

```bash
npm install
npm run build     # or: npm run watch
```

Python dev dependencies (`aqt[qt6]` for type hints/completion, `mypy`, `ruff`):

```bash
uv sync
```

## Layout

| Path | Role |
| --- | --- |
| `src/ace/__init__.py` | Add-on entry point; registers the Anki GUI hooks. |
| `src/ace/hooks.py` | Hook handlers, note type definition, card templates and CSS. |
| `src/ace/executor.py` | Runs the executor script and compares the two outputs. |
| `src/ace/paths.py` | Resolves the add-on's package name and webview asset URLs. |
| `src/ace/anki_types.py` | `TypedDict`s for Anki's otherwise untyped note type dicts. |
| `src/ace/web/editor.js` | Replaces code fields in the note editor with CodeMirror. |
| `src/ace/web/review.js` | Mounts the review editor, relays keystrokes, renders results. |
| `web/src/codemirror.js` | esbuild entry point for the CodeMirror bundle. |
| `scripts/package.py` | Builds the distributable `.ankiaddon` archive. |
| `src/ace/manifest.json` | Add-on identity, read by Anki when installing a package. |

## Packaging

`src/ace/manifest.json` names the add-on for installs from a `.ankiaddon` file or
from AnkiWeb — Anki reads it out of the archive to decide what to call the add-on
and which folder to unpack it into. It is ignored for a symlinked working copy, so
it has no effect during development.

```json
{
    "package": "ace",
    "name": "ACE (Anki Code Extension)"
}
```

Publishing to AnkiWeb means changing `package` to the numeric ID AnkiWeb assigns,
since that is the folder name an install will use. Nothing else needs to change:
the Python imports are relative and the asset URLs are derived at runtime.

To build a distributable `.ankiaddon`:

```bash
npm run package          # or: python3 scripts/package.py
```

That rebuilds the CodeMirror bundle, then zips the *contents* of `src/ace/` —
manifest at the archive root, no enclosing directory, no `__pycache__` — into
`dist/<package>-<version>.ankiaddon`, versioned from `pyproject.toml`. Pass
`--skip-build` to archive the bundle as it already stands.
