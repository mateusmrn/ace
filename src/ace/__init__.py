from aqt import mw
from aqt.gui_hooks import (
    collection_did_load,
    editor_will_load_note,
    reviewer_did_show_answer,
    reviewer_did_show_question,
    webview_did_receive_js_message,
    webview_will_set_content,
)

from ace.hooks import (
    handle_reviewer_js_message,
    init_code_note_type,
    inject_extension_js_into_webview,
    override_code_field_ui_component,
    reset_latest_input_code,
    run_code_comparison_on_show_answer,
)
from ace.logger import logger

mw.addonManager.setWebExports("ace", r"web/.*\.(js|css|map)")

# Anki hooks setup
collection_did_load.append(init_code_note_type)
webview_will_set_content.append(inject_extension_js_into_webview)
editor_will_load_note.append(override_code_field_ui_component)
webview_did_receive_js_message.append(handle_reviewer_js_message)
reviewer_did_show_question.append(reset_latest_input_code)
reviewer_did_show_answer.append(run_code_comparison_on_show_answer)

logger.info("Hooks have been set, add-on is ready")
