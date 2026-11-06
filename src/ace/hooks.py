from anki.notes import Note
from aqt.editor import Editor
from aqt.webview import WebContent

from ace.logger import logger


def inject_extension_js_into_editor_webview(web_content: WebContent, context: object | None):
    if not isinstance(context, Editor):
        return
    web_content.js.append("/_addons/ace/web/codemirror.js")
    web_content.js.append("/_addons/ace/web/ace.js")
    logger.info("Extension JavaScript successfully injected into the Editor webview")


def override_code_field_ui_component(js_args: str, note: Note, _: Editor):
    if note.note_type().get("name") == "Basic":
        js_args += "\nwindow.__ACE__.onCodeNoteTypeLoad();\n"
    else:
        js_args += "\nwindow.__ACE__.onCodeNoteTypeUnload();\n"
    return js_args
