# Versioning

Every change to the add-on must bump the version in `pyproject.toml`
(`[project].version`), then run `uv lock` so `uv.lock`'s pinned version for the
`ace` package stays in sync. Do this as part of the same commit as the change
itself, not as a separate follow-up.

Use semantic versioning (`MAJOR.MINOR.PATCH`):

- **PATCH** — bug fixes, internal refactors, anything that doesn't change behavior
  users rely on.
- **MINOR** — backwards-compatible new functionality (a new field, a new button,
  new executor behavior that doesn't break existing notes).
- **MAJOR** — breaking changes (note type schema changes that aren't
  auto-migrated, removed fields, anything that would require a user to redo
  existing cards).

No separate changelog file is required — the version bump itself, plus the commit
message, is the record.

`scripts/package.py` already names the built archive from this version
(`dist/<package>-<version>.ankiaddon`), so bumping `pyproject.toml` is sufficient
to keep the packaged output's filename in sync — no other file needs editing for
that part.
