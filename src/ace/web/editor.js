class AceExtension {
  static #FIELD_OVERRIDE_STYLE_BLOCK_ID = "ace-code-field-override-css";
  static #FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS =
    "ace-code-field-override-substitute";

  /**
   * @typedef {object} FieldOverrideConfig
   *  @property {number} index The index of the position of the field in the form
   *  @property {string | undefined} language The language of the substitute CodeMirror element
   */

  /**
   * @template T
   * @typedef {object} Readable
   * @property {(run: (value: T) => void) => (() => void)} subscribe
   */

  /**
   * @template T
   * @typedef {object} Writable
   * @property {(value: T) => void} set
   * @property {(updater: (value: T) => T) => void} update
   * @property {(run: (value: T) => void) => (() => void)} subscribe
   */

  /**
   * @typedef {object} FocusableInputAPI
   * @property {string} name
   * @property {boolean} focusable
   * @property {() => void} focus
   * @property {() => void} refocus
   */

  /**
   * @typedef {object} EditingInputAPI
   * @property {(target: EventTarget) => Promise<FocusableInputAPI | null>} getInputAPI
   */

  /**
   * @typedef {object} EditingAreaAPI
   * @property {Writable<string>} content Field's text content
   * @property {Writable<EditingInputAPI[]>} editingInputs
   * @property {() => void} focus
   * @property {() => void} refocus
   */

  /**
   * @typedef {object} EditorFieldAPI
   * @property {Promise<HTMLElement>} element
   * @property {Readable<"ltr" | "rtl">} direction
   * @property {EditingAreaAPI} editingArea
   */

  /**
   * @typedef {object} RemoveFormat
   * @property {string} name
   * @property {string} key
   * @property {boolean} show
   * @property {boolean} active
   */

  /**
   * @typedef {object} EditorToolbarAPI
   * @property {object} toolbar Slot of toolbar buttons (not typed further -- unused here)
   * @property {object} notetypeButtons Slot of notetype-specific buttons (not typed further -- unused here)
   * @property {object} inlineButtons Slot of inline-formatting buttons (not typed further -- unused here)
   * @property {object} blockButtons Slot of block-formatting buttons (not typed further -- unused here)
   * @property {object} templateButtons Slot of template buttons (not typed further -- unused here)
   * @property {Writable<RemoveFormat[]>} removeFormats
   */

  /**
   * @typedef {-1 | 0 | 1 | 2 | 3} EditorState
   * Initial = -1, Fields = 0, ImageOcclusionPicker = 1, ImageOcclusionMasks = 2, ImageOcclusionFields = 3
   */

  /**
   * @typedef {object} NoteEditorAPI
   * @property {EditorFieldAPI[]} fields
   * @property {Writable<EditorFieldAPI | null>} hoveredField
   * @property {Writable<EditorFieldAPI | null>} focusedField
   * @property {Writable<EditingInputAPI | null>} focusedInput
   * @property {EditorToolbarAPI} toolbar
   * @property {Writable<EditorState>} state
   * @property {Writable<string | null>} lastIOImagePath
   * @property {() => Promise<void>} saveNow
   * @property {boolean} isLegacy
   */

  /**
   * @param {FieldOverrideConfig[]} fieldsOverrideConfig
   */
  onCodeNoteTypeLoad(fieldsOverrideConfig) {
    /** @type {Promise<NoteEditorAPI>} */
    const noteEditor = new Promise((res) => {
      const ankiNoteEditor = require("anki/NoteEditor");
      if (ankiNoteEditor.instances.length > 0) {
        return res(ankiNoteEditor.instances[0]);
      } else {
        ankiNoteEditor.lifecycle.onMount((api) => res(api));
      }
    });

    noteEditor.then((editor) => {
      const substituteElementsAlreadyPresent =
        document.querySelector(
          "." + AceExtension.#FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS,
        ) !== null;

      if (substituteElementsAlreadyPresent) {
        return;
      }

      const fieldsCssSelectors = fieldsOverrideConfig.map(
        (config) =>
          `.note-editor .fields > :nth-child(${config.index + 1}) .collapsible`,
      );
      const style = document.createElement("style");
      style.id = AceExtension.#FIELD_OVERRIDE_STYLE_BLOCK_ID;
      style.textContent = `
       ${fieldsCssSelectors.join(",")} {
          display: none !important;
        }
       ;`;
      document.head.append(style);

      fieldsOverrideConfig.forEach((fieldConfig) => {
        const selector = `.note-editor .fields > :nth-child(${fieldConfig.index + 1}) .collapsible`;
        void waitForElement(selector).then((el) => {
          const view = new window.CodeMirror.EditorView({
            parent: el.parentElement,
            extensions: [
              window.CodeMirror.basicSetup,
              window.CodeMirror.EditorView.editorAttributes.of({
                class: AceExtension.#FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS,
              }),
              window.CodeMirror.EditorView.updateListener.of((viewUpdate) => {
                if (viewUpdate.docChanged) {
                  const newValue = viewUpdate.state.doc.toString();
                  editor.fields[fieldConfig.index].editingArea.content.set(
                    newValue,
                  );
                }
              }),
            ],
          });

          editor.fields[fieldConfig.index].editingArea.content.subscribe(
            (value) => {
              const currentDoc = view.state.doc.toString();
              if (value === currentDoc) {
                return;
              }
              view.dispatch({
                changes: { from: 0, to: currentDoc.length, insert: value },
              });
            },
          );
        });
      });
    });
  }

  onCodeNoteTypeUnload() {
    const styleBlock = document.getElementById(
      AceExtension.#FIELD_OVERRIDE_STYLE_BLOCK_ID,
    );
    styleBlock?.remove();

    const substituteElements = document.getElementsByClassName(
      AceExtension.#FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS,
    );
    Array.from(substituteElements).forEach((el) => el.remove());
  }
}

window.__ACE__ = new AceExtension();

function waitForElement(selector) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    const observer = new MutationObserver((_, obs) => {
      const targetElement = document.querySelector(selector);
      if (targetElement) {
        obs.disconnect();
        resolve(targetElement);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}
