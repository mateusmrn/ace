import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";

window.CodeMirror = {
  EditorView,
  EditorState,
  basicSetup,
  StreamLanguage,
  languages: { shell },
};
