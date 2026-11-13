import json
from typing import Any, cast

from anki.cards import Card
from anki.collection import Collection
from anki.notes import Note
from aqt import mw
from aqt.editor import Editor
from aqt.operations import QueryOp
from aqt.reviewer import Reviewer
from aqt.webview import WebContent

from .anki_types import NotetypeDict
from .executor import ExecutionResult, compare_reference_and_input_code
from .logger import logger
from .paths import web_asset_url

code_note_type_name = "ACE Code"

_EXECUTOR_SCRIPT_DESCRIPTION = (
    "Bash script. Available variables: $ACE_CODE_FILE (path to whichever code is "
    "currently being run), $ACE_REFERENCE_CODE_FILE (only set while running the "
    "reference code), $ACE_INPUT_CODE_FILE (only set while running the submitted code)."
)

_MOBILE_WARNING = (
    '<div id="ace-mobile-warning">'
    "This card does not work properly on mobile phones. We recommend that you "
    "bury it and study it on your computer."
    "</div>"
)

_QFMT = f"""
{_MOBILE_WARNING}

<div class="ace-problem-statement">{{{{Problem Statement}}}}</div>

<div id="ace-review-input"></div>
"""

_AFMT = f"""
{_MOBILE_WARNING}

{{{{Problem Statement}}}}
<hr id=answer>
{{{{Reference Code}}}}

<div id="ace-review-spinner">
  <div class="ace-spinner"></div>
</div>

<div id="ace-review-result" class="ace-hidden"></div>
"""

_CSS = """
.card {
    font-family: arial;
    font-size: 20px;
    text-align: center;
    color: black;
    background-color: white;
}

/* AnkiDroid/AnkiMobile add a "mobile" class to the document root; none of this
   add-on's JS loads there (no add-on system on mobile clients), so the warning
   is pure CSS, hidden on desktop and shown only on mobile. */
#ace-mobile-warning {
    display: none;
    margin: 1em auto;
    max-width: 40em;
    padding: 0.75em;
    border: 1px solid #b45309;
    border-radius: 3px;
    background: #fef3c7;
    color: #92400e;
    text-align: left;
}

.mobile #ace-mobile-warning {
    display: block;
}

#ace-review-input {
    text-align: left;
    margin: 1em auto;
    max-width: 40em;
    border: 1px solid #444;
    border-radius: 3px;
    overflow: hidden;
}

#ace-review-input .cm-editor {
    min-height: 4em;
}

#ace-review-input .cm-scroller {
    font-family: monospace;
}

.ace-hidden {
    display: none;
}

.ace-spinner {
    margin: 1em auto;
    width: 2em;
    height: 2em;
    border: 0.3em solid #c4c4c4;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: ace-spin 0.8s linear infinite;
}

@keyframes ace-spin {
    to { transform: rotate(360deg); }
}

#ace-review-result {
    margin: 1em auto;
    max-width: 40em;
    text-align: left;
}

.ace-result-success { color: #15803d; }
.ace-result-failure { color: #b45309; }
.ace-result-error { color: #b91c1c; }

#ace-review-result pre {
    text-align: left;
    white-space: pre-wrap;
    background: #f5f5f5;
    border: 1px solid #c4c4c4;
    padding: 0.5em;
}
"""


def init_code_note_type(collection: Collection):
    model_manager = collection.models

    code_note_type = cast(NotetypeDict | None, model_manager.by_name(code_note_type_name))

    if code_note_type is None:
        logger.debug(f"{code_note_type_name} note type does not exist. Creating it now")

        code_note_type = cast(NotetypeDict, model_manager.new(code_note_type_name))
        # Anki's own ModelManager methods take/return dict[str, Any]; a TypedDict isn't
        # assignable to that (it would let callers add arbitrary keys), so hand them the
        # untyped view at each call while keeping the structured one for our own reads/writes.
        raw_code_note_type = cast(dict[str, Any], code_note_type)

        model_manager.add_field(raw_code_note_type, model_manager.new_field("Problem Statement"))
        model_manager.add_field(raw_code_note_type, model_manager.new_field("Reference Code"))
        model_manager.add_field(raw_code_note_type, model_manager.new_field("Executor Script"))

        note_type_template = model_manager.new_template("Card 1")
        note_type_template["qfmt"] = _QFMT
        note_type_template["afmt"] = _AFMT
        model_manager.add_template(raw_code_note_type, note_type_template)
        raw_code_note_type["css"] = _CSS

        # add() mutates raw_code_note_type (== code_note_type) in place with the
        # persisted id/tmpls/etc., so code_note_type is already up to date here.
        model_manager.add(raw_code_note_type)

    # Always re-sync the template/css with what's defined in code, so changes here take
    # effect without needing to delete and recreate an already-existing note type.
    raw_code_note_type = cast(dict[str, Any], code_note_type)
    template = code_note_type["tmpls"][0]
    template["qfmt"] = _QFMT
    template["afmt"] = _AFMT
    code_note_type["css"] = _CSS
    model_manager.update_dict(raw_code_note_type)

    logger.info(f"{code_note_type_name} note type initialized")


def inject_extension_js_into_webview(web_content: WebContent, context: object | None):
    if isinstance(context, Editor):
        web_content.css.append(web_asset_url("editor.css"))
        web_content.js.append(web_asset_url("codemirror.js"))
        web_content.js.append(web_asset_url("editor.js"))
        logger.info("Extension JavaScript successfully injected into the Editor webview")
    elif isinstance(context, Reviewer):
        web_content.js.append(web_asset_url("codemirror.js"))
        web_content.js.append(web_asset_url("review.js"))
        logger.info("Extension JavaScript successfully injected into the Reviewer webview")


def override_code_field_ui_component(js_args: str, note: Note, editor: Editor):
    note_type = cast(NotetypeDict | None, note.note_type())
    if note_type is not None and note_type["name"] == code_note_type_name:
        reference_code_field = next(
            field for field in note_type["flds"] if field["name"] == "Reference Code"
        )
        executor_script_field = next(
            field for field in note_type["flds"] if field["name"] == "Executor Script"
        )
        js_args += (
            "\nwindow.__ACE__.onCodeNoteTypeLoad([\n"
            f"  {{ index: {reference_code_field['ord']} }},\n"
            f"  {{ index: {executor_script_field['ord']},"
            f" language: {json.dumps('shell')},"
            f" description: {json.dumps(_EXECUTOR_SCRIPT_DESCRIPTION)} }}\n"
            "]);\n"
        )
    else:
        js_args += "\nwindow.__ACE__.onCodeNoteTypeUnload();\n"
    return js_args


_INPUT_CHANGED_MESSAGE_PREFIX = "ace_input_changed:"

# The user's typed code never lives in a note field (it's ephemeral, per-attempt),
# so it's only known to the reviewer's webview JS. review.js relays it here on every
# keystroke; by the time reviewer_did_show_answer fires we already have the latest
# value without needing to ask the (possibly already-replaced) question-side DOM for it.
_latest_input_code = ""


def _push_review_result(reviewer: Reviewer, result: ExecutionResult) -> None:
    reviewer.web.eval(f"window.__ACE_REVIEW__.onResult({json.dumps(result)});")


def handle_reviewer_js_message(
    handled: tuple[bool, Any], message: str, context: object
) -> tuple[bool, Any]:
    global _latest_input_code

    if not isinstance(context, Reviewer):
        return handled

    if not message.startswith(_INPUT_CHANGED_MESSAGE_PREFIX):
        return handled

    try:
        payload = json.loads(message[len(_INPUT_CHANGED_MESSAGE_PREFIX) :])
        _latest_input_code = payload["inputCode"]
    except Exception:
        logger.exception("Failed to handle ace_input_changed message")

    return (True, None)


def reset_latest_input_code(card: Card) -> None:
    # A card's front might go untouched (no keystrokes to relay a fresh value), so
    # without this the previous card's input could still look current.
    global _latest_input_code
    _latest_input_code = ""


def run_code_comparison_on_show_answer(card: Card) -> None:
    note_type = cast(NotetypeDict, card.note_type())
    if note_type["name"] != code_note_type_name:
        return

    reviewer = mw.reviewer
    try:
        note = card.note()
        reference_code = note["Reference Code"]
        executor_script = note["Executor Script"]
    except Exception as error:
        logger.exception("Failed to read ACE Code fields for comparison")
        _push_review_result(reviewer, {"status": "error", "message": str(error)})
        return

    input_code = _latest_input_code

    def run(_: Collection) -> ExecutionResult:
        return compare_reference_and_input_code(reference_code, input_code, executor_script)

    def on_done(result: ExecutionResult) -> None:
        _push_review_result(reviewer, result)

    QueryOp(parent=mw, op=run, success=on_done).without_collection().run_in_background()
