"""Structured alternative to anki.models.NotetypeDict (= dict[str, Any]).

Anki's own note type dicts carry no field-level type information -- reverse
engineered here from anki.models.ModelManager (new/new_field/new_template)
and from inspecting a real Collection's stock "Basic"/"Cloze" note types at
runtime. Anki's own API still returns/accepts the untyped dict, so cast() at
the boundary to get any benefit from these, e.g.:

    nt = cast(NotetypeDict, mw.col.models.by_name("ACE Code"))
"""

from typing import Literal, NotRequired, TypedDict

from anki.models import NotetypeId


class FieldDict(TypedDict):
    """One entry in a note type's "flds" list -- defines a single field."""

    id: int
    """Stable identity for this field, independent of its name or position."""

    name: str
    """Field's display name shown in the editor, e.g. "Front"."""

    ord: int | None
    """0-based position within the note type's field list. None until the field is saved."""

    sticky: bool
    """If true, this field's content carries over into the next new note instead of being
    cleared."""

    rtl: bool
    """If true, the field is edited right-to-left (for scripts like Arabic/Hebrew)."""

    font: str
    """Font family used when editing this field."""

    size: int
    """Font size (px) used when editing this field."""

    description: str
    """Short help text shown under the field box in the editor."""

    plainText: bool
    """If true, edits as plain text instead of the rich-text (WYSIWYG) editor."""

    collapsed: bool
    """If true, the field's editor box starts collapsed/hidden."""

    excludeFromSearch: bool
    """If true, this field's content is skipped when searching notes in the Browser."""

    tag: int | None
    """Cloze deletion group index (e.g. 0 for {{c1::...}}). None for non-cloze fields."""

    preventDeletion: bool
    """If true, the UI blocks deleting this field (e.g. Cloze's "Text" field)."""


class TemplateDict(TypedDict):
    """One entry in a note type's "tmpls" list -- defines one generated card per note."""

    id: int
    """Stable identity for this template, independent of its name or position."""

    name: str
    """Template's display name, e.g. "Card 1"."""

    ord: int | None
    """0-based position within the note type's template list; also the generated card's "ord"."""

    qfmt: str
    """Question-side template: HTML with {{Field}} placeholders."""

    afmt: str
    """Answer-side template: HTML with {{Field}} placeholders, typically including {{FrontSide}}."""

    bqfmt: str
    """Override for qfmt used only by the Browse-pane preview. Empty string falls back to qfmt."""

    bafmt: str
    """Override for afmt used only by the Browse-pane preview. Empty string falls back to afmt."""

    did: int | None
    """Deck override: cards from this template go here instead of the note type's default deck."""

    bfont: str
    """Font override for the Browse-pane preview. Empty string means use the regular field font."""

    bsize: int
    """Font size override for the Browse-pane preview. 0 means use the regular field size."""


ReqEntry = tuple[int, Literal["any", "all", "none"], list[int]]
"""(template ord, requirement kind, field ords): cached rule for whether a template generates
a card from a given note -- "any"/"all" of the listed fields must be non-empty, or "none" of
them may be. Recomputed by Anki whenever templates/fields change; don't set by hand."""


class NotetypeDict(TypedDict):
    """Structured counterpart of anki.models.NotetypeDict, Anki's dict-based note type.

    Fetched via e.g. mw.col.models.by_name(...)/new(...), which are typed as returning the
    untyped anki.models.NotetypeDict -- cast() to this type to get field-level checking.
    """

    id: NotetypeId
    """Note type's ID. 0 until it has been added to the collection."""

    name: str
    """Display name shown in the "Type" dropdown when adding notes, e.g. "Basic"."""

    type: Literal[0, 1]
    """0 = standard note type, 1 = Cloze note type (anki.consts.MODEL_STD / MODEL_CLOZE)."""

    mod: int
    """Last-modified time (Unix seconds). Used to resolve sync conflicts."""

    usn: int
    """Update sequence number, used by AnkiWeb sync to detect what's changed since last sync."""

    sortf: int
    """ord of the field used to sort/group notes in the Browser and for duplicate detection."""

    did: int | None
    """Default deck new cards of this note type are added to. None if unset."""

    tmpls: list[TemplateDict]
    """Card templates -- one card is generated per note for each entry here."""

    flds: list[FieldDict]
    """Field definitions for this note type."""

    css: str
    """CSS shared by every card generated from this note type."""

    latexPre: str
    """LaTeX document preamble prepended when rendering [latex] tags in field content."""

    latexPost: str
    """LaTeX document suffix appended after the rendered LaTeX body."""

    latexsvg: bool
    """If true, render LaTeX as SVG instead of PNG."""

    req: list[ReqEntry]
    """Cached per-template field requirements, recomputed whenever templates/fields change."""

    originalStockKind: int
    """Which built-in note type this was originally cloned from (notetypes_pb2.StockNotetype.Kind);
    drives whether the UI offers "restore to default"."""

    originalId: NotRequired[int | None]
    """ID of the note type this one was duplicated from. Only set by ModelManager.copy();
    absent on note types that were never copied."""
