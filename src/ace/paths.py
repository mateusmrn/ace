"""Resolution of this add-on's own package name and webview asset URLs.

The folder an add-on lives in under addons21/ is also its package name, and it is
not fixed: during development it's whatever the source is symlinked as, while an
AnkiWeb install names it after the add-on's numeric ID (see manifest.json's
"package"). Derive it from __name__ rather than hardcoding, so the webview asset
URLs keep pointing at wherever this copy actually is.
"""

ADDON_PACKAGE = __name__.split(".")[0]
"""Name of the folder this add-on is installed as, e.g. "ace"."""


def web_asset_url(file_name: str) -> str:
    """URL of a file in this add-on's web/ directory, as served to a webview.

    Only paths matching the pattern passed to setWebExports() are actually served.
    """
    return f"/_addons/{ADDON_PACKAGE}/web/{file_name}"
