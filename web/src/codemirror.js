import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { darcula } from "@uiw/codemirror-theme-darcula";

window.CodeMirror = {
  EditorView,
  EditorState,
  basicSetup,
  keymap,
  indentWithTab,
  StreamLanguage,
  languages: { shell },
  darcula,
};
