from aqt.editor import Editor
from aqt import mw
from aqt.webview import WebContent
from anki.notes import Note
from aqt.gui_hooks import editor_will_load_note, webview_will_set_content
import logging

logger = logging.getLogger("Anki Code Extension")

mw.addonManager.setWebExports(__name__, r"web/.*\.(js|css|map)")

def on_webview_will_set_content(web_content: WebContent, context: object | None):
    if not isinstance(context, Editor):
        return
    ace_addon_name = mw.addonManager.addon_from_module(__name__)
    web_content.js.append(f"/_addons/{ace_addon_name}/web/ace.js")

def on_editor_will_load_note(js_args: str, note: Note, _: Editor):
    if note.note_type().get("name") == 'Basic':
        js_args += "\nwindow.__ACE__.onCodeNoteTypeLoad();\n"
    else:
        js_args += "\nwindow.__ACE__.onCodeNoteTypeUnload();\n"
    return js_args

editor_will_load_note.append(on_editor_will_load_note)
webview_will_set_content.append(on_webview_will_set_content)
