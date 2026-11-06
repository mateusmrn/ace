from anki.collection import Collection
from anki.notes import Note
from aqt.editor import Editor
from aqt.webview import WebContent

from ace.logger import logger

code_note_type_name = "ACE Code"


def init_code_note_type(collection: Collection):
    model_manager = collection.models

    code_note_type = model_manager.by_name(code_note_type_name)

    if code_note_type is None:
        logger.debug(f"{code_note_type_name} note type does not exist. Creating it now")

        code_note_type = model_manager.new(code_note_type_name)

        model_manager.add_field(code_note_type, model_manager.new_field("Problem Statement"))
        model_manager.add_field(code_note_type, model_manager.new_field("Reference Code"))

        note_type_template = model_manager.new_template("Card 1")
        note_type_template["qfmt"] = "{{Problem Statement}}"
        note_type_template["afmt"] = "{{Problem Statement}}\n<hr id=answer>\n{{Reference Code}}"
        model_manager.add_template(code_note_type, note_type_template)

        code_note_type["css"] = """
        .card {
            font-family: arial;
            font-size: 20px;
            text-align: center;
            color: black;
            background-color: white;
        }
        """

        model_manager.add(code_note_type)

    logger.info(f"{code_note_type_name} note type initialized")


def inject_extension_js_into_editor_webview(web_content: WebContent, context: object | None):
    if not isinstance(context, Editor):
        return
    web_content.js.append("/_addons/ace/web/codemirror.js")
    web_content.js.append("/_addons/ace/web/ace.js")
    logger.info("Extension JavaScript successfully injected into the Editor webview")


def override_code_field_ui_component(js_args: str, note: Note, _: Editor):
    if note.note_type().get("name") == code_note_type_name:
        js_args += "\nwindow.__ACE__.onCodeNoteTypeLoad();\n"
    else:
        js_args += "\nwindow.__ACE__.onCodeNoteTypeUnload();\n"
    return js_args
