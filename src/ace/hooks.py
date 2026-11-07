from typing import Any, cast

from anki.collection import Collection
from anki.notes import Note
from aqt.editor import Editor
from aqt.webview import WebContent

from ace.anki_types import NotetypeDict
from ace.logger import logger

code_note_type_name = "ACE Code"


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
        note_type_template["qfmt"] = "{{Problem Statement}}"
        note_type_template["afmt"] = "{{Problem Statement}}\n<hr id=answer>\n{{Reference Code}}"
        model_manager.add_template(raw_code_note_type, note_type_template)

        code_note_type["css"] = """
        .card {
            font-family: arial;
            font-size: 20px;
            text-align: center;
            color: black;
            background-color: white;
        }
        """

        model_manager.add(raw_code_note_type)

    logger.info(f"{code_note_type_name} note type initialized")


def inject_extension_js_into_editor_webview(web_content: WebContent, context: object | None):
    if not isinstance(context, Editor):
        return
    web_content.js.append("/_addons/ace/web/codemirror.js")
    web_content.js.append("/_addons/ace/web/ace.js")
    logger.info("Extension JavaScript successfully injected into the Editor webview")


def override_code_field_ui_component(js_args: str, note: Note, _: Editor):
    note_type = cast(NotetypeDict | None, note.note_type())
    if note_type is not None and note_type["name"] == code_note_type_name:
        reference_code_field = next(
            field for field in note_type["flds"] if field["name"] == "Reference Code"
        )
        executor_script_field = next(
            field for field in note_type["flds"] if field["name"] == "Executor Script"
        )
        js_args += f"\nwindow.__ACE__.onCodeNoteTypeLoad([{{ index: {reference_code_field['ord']} }}, {{ index: {executor_script_field['ord']}}}]);\n"
    else:
        js_args += "\nwindow.__ACE__.onCodeNoteTypeUnload();\n"
    return js_args
