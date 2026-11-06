from aqt import mw
from aqt.gui_hooks import editor_will_load_note, webview_will_set_content

from ace.hooks import inject_extension_js_into_editor_webview, override_code_field_ui_component
from ace.logger import logger

mw.addonManager.setWebExports("ace", r"web/.*\.(js|css|map)")

webview_will_set_content.append(inject_extension_js_into_editor_webview)
editor_will_load_note.append(override_code_field_ui_component)

logger.info("Hooks have been set, add-on is ready")
