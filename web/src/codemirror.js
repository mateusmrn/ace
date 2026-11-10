import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { darcula } from "@uiw/codemirror-theme-darcula";

window.CodeMirror = {
  EditorView,
  EditorState,
  basicSetup,
  StreamLanguage,
  languages: { shell },
  darcula,
};
