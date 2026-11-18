class AceExtension {
  static #FIELD_OVERRIDE_STYLE_BLOCK_ID = "ace-code-field-override-css";
  static #FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS =
    "ace-code-field-override-substitute";
  static #RUN_BUTTON_LABEL = "Run Reference Code";

  /** @type {Map<string, object>} CodeMirror views, keyed by note field name. */
  #viewsByFieldName = new Map();
  /** @type {HTMLButtonElement | null} */
  #runButton = null;
  /** @type {HTMLElement | null} */
  #runOutput = null;
  // Bumped on every load/unload. The note editor is a single persistent page, so
  // switching note types never reloads it -- without this, mount work started for
  // one note (waiting on fields that hadn't rendered yet) can still resolve after
  // the note type changes and wire a CodeMirror editor into whatever field happens
  // to sit at the same position (e.g. Basic's "Back" lines up with Reference
  // Code's ordinal index), fighting the real field for every keystroke.
  /** @type {number} */
  #mountGeneration = 0;
  /** @type {Array<() => void>} Cancels fields still waiting to render, so
   *  onCodeNoteTypeUnload() doesn't leave their observers running forever. */
  #pendingCancels = [];
  /** @type {Array<() => void>} Unsubscribes + destroys views that did mount, so
   *  they stop bridging into whatever field reuses their slot afterwards. */
  #activeTeardowns = [];

  /**
   * @typedef {object} FieldOverrideConfig
   *  @property {number} index The index of the position of the field in the form
   *  @property {string} name The note field's name, e.g. "Reference Code"
   *  @property {string | undefined} language The language of the substitute CodeMirror element
   *  @property {string | undefined} description Text shown below the substitute CodeMirror element
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
    // onCodeNoteTypeLoad can be called again before the previous call's async
    // mounting work has created any DOM elements yet (e.g. right after adding a
    // note), so this needs to be a synchronous claim -- checking the DOM for
    // existing elements later, after an await, lets concurrent calls race past it.
    if (window.__ACE_FIELDS_MOUNTED__) {
      return;
    }
    window.__ACE_FIELDS_MOUNTED__ = true;
    const generation = ++this.#mountGeneration;

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
      if (generation !== this.#mountGeneration) {
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

      const mounted = fieldsOverrideConfig.map((fieldConfig) => {
        const selector = `.note-editor .fields > :nth-child(${fieldConfig.index + 1}) .collapsible`;
        const wait = waitForElement(selector);
        this.#pendingCancels.push(wait.cancel);
        return wait.promise.then((el) => {
          if (generation !== this.#mountGeneration) {
            return null;
          }

          const container = document.createElement("div");
          container.className = AceExtension.#FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS;
          el.parentElement.append(container);

          const editorBox = document.createElement("div");
          editorBox.className = "ace-code-editor-box";
          container.append(editorBox);

          const extensions = [
            window.CodeMirror.basicSetup,
            window.CodeMirror.darcula,
            // Tab indents rather than moving to the next field. That does override
            // Anki's usual field navigation, so note the way out: Escape arms
            // CodeMirror's tab-focus mode for two seconds, during which Tab and
            // Shift-Tab move focus as normal (Ctrl-m, or Shift-Alt-m on macOS,
            // toggles the same thing without the time limit).
            window.CodeMirror.keymap.of([window.CodeMirror.indentWithTab]),
            window.CodeMirror.EditorView.updateListener.of((viewUpdate) => {
              if (viewUpdate.docChanged) {
                const newValue = viewUpdate.state.doc.toString();
                editor.fields[fieldConfig.index].editingArea.content.set(
                  AceExtension.#escapeHtml(newValue),
                );
              }
            }),
          ];

          if (fieldConfig.language === "shell") {
            extensions.push(
              window.CodeMirror.StreamLanguage.define(
                window.CodeMirror.languages.shell,
              ),
            );
          }

          const view = new window.CodeMirror.EditorView({
            parent: editorBox,
            extensions,
          });

          if (fieldConfig.description) {
            const description = document.createElement("p");
            description.className = "ace-field-override-description";
            description.textContent = fieldConfig.description;
            container.append(description);
          }

          const unsubscribe = editor.fields[
            fieldConfig.index
          ].editingArea.content.subscribe((value) => {
            const newValue = AceExtension.#unescapeHtml(value);
            const currentDoc = view.state.doc.toString();
            if (newValue === currentDoc) {
              return;
            }
            view.dispatch({
              changes: { from: 0, to: currentDoc.length, insert: newValue },
            });
          });

          // Anki's note editor is a single persistent page -- switching note type
          // never recreates it, it just rebinds editor.fields to the new note's
          // fields. Without tearing these down, this subscription and the view's
          // updateListener above stay live and keep bridging whatever field next
          // lands at this same ordinal index (e.g. Basic's "Back" field, which sits
          // at the same position as Reference Code), each keystroke there fighting
          // the stale CodeMirror doc for control of the field's content.
          this.#activeTeardowns.push(() => {
            unsubscribe();
            view.destroy();
          });

          this.#viewsByFieldName.set(fieldConfig.name, view);
          return container;
        });
      });

      // Mounted last so the panel sits below every code field rather than between
      // two of them -- the fields resolve in whatever order their elements appear.
      void Promise.all(mounted).then((containers) => {
        if (generation !== this.#mountGeneration) {
          return;
        }
        this.#mountRunner(containers[containers.length - 1]);
      });
    });
  }

  /**
   * Button that runs the Reference Code through the Executor Script, so a card can be
   * checked while it is being written rather than at review time.
   * @param {HTMLElement} lastFieldContainer
   */
  #mountRunner(lastFieldContainer) {
    const container = document.createElement("div");
    // Same class the field substitutes use, so onCodeNoteTypeUnload() sweeps it up.
    container.className = `${AceExtension.#FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS} ace-code-runner`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ace-run-button";
    button.textContent = AceExtension.#RUN_BUTTON_LABEL;
    container.append(button);

    const output = document.createElement("div");
    output.className = "ace-run-output";
    output.hidden = true;
    container.append(output);

    button.addEventListener("click", () => {
      const referenceCode = this.#docOf("Reference Code");
      const executorScript = this.#docOf("Executor Script");

      button.disabled = true;
      button.textContent = "Running...";
      output.hidden = false;
      output.replaceChildren(
        AceExtension.#textNode("p", "Running...", "ace-run-status"),
      );

      pycmd(
        `ace_run_reference:${JSON.stringify({ referenceCode, executorScript })}`,
      );
    });

    this.#runButton = button;
    this.#runOutput = output;
    lastFieldContainer.parentElement.append(container);
  }

  #docOf(fieldName) {
    const view = this.#viewsByFieldName.get(fieldName);
    return view ? view.state.doc.toString() : "";
  }

  /**
   * Called by Python once the reference run finishes.
   * @param {{status: "completed", exitCode: number, stdout: string, stderr: string}
   *   | {status: "error", message: string}} result
   */
  onReferenceRunResult(result) {
    const button = this.#runButton;
    const output = this.#runOutput;
    if (!output) {
      return; // the note type changed while the run was in flight
    }

    if (button) {
      button.disabled = false;
      button.textContent = AceExtension.#RUN_BUTTON_LABEL;
    }

    output.hidden = false;
    output.replaceChildren();

    if (result.status === "error") {
      output.append(
        AceExtension.#textNode("p", result.message, "ace-run-status ace-run-bad"),
      );
      return;
    }

    const ok = result.exitCode === 0;
    output.append(
      AceExtension.#textNode(
        "p",
        ok ? "Ran successfully." : `Exited with status ${result.exitCode}.`,
        `ace-run-status ${ok ? "ace-run-good" : "ace-run-bad"}`,
      ),
    );

    if (result.stdout) {
      output.append(AceExtension.#textNode("p", "stdout", "ace-run-label"));
      output.append(AceExtension.#textNode("pre", result.stdout));
    }
    if (result.stderr) {
      output.append(AceExtension.#textNode("p", "stderr", "ace-run-label"));
      output.append(AceExtension.#textNode("pre", result.stderr));
    }
    if (!result.stdout && !result.stderr) {
      output.append(AceExtension.#textNode("p", "(no output)", "ace-run-label"));
    }
  }

  static #textNode(tagName, text, className) {
    const el = document.createElement(tagName);
    el.textContent = text;
    if (className) {
      el.className = className;
    }
    return el;
  }

  // Anki field content is HTML, but CodeMirror's doc is the raw source text, so
  // every value crossing that boundary needs to be escaped going in and decoded
  // coming out -- otherwise a bare "<" gets parsed as the start of a tag by the
  // (hidden) rich-text field underneath, which is what corrupts the doc as you type.
  static #escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  static #unescapeHtml(html) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    return textarea.value;
  }

  onCodeNoteTypeUnload() {
    window.__ACE_FIELDS_MOUNTED__ = false;
    this.#mountGeneration++;
    this.#pendingCancels.forEach((cancel) => cancel());
    this.#pendingCancels = [];
    this.#activeTeardowns.forEach((teardown) => teardown());
    this.#activeTeardowns = [];
    this.#viewsByFieldName.clear();
    this.#runButton = null;
    this.#runOutput = null;

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

/**
 * @param {string} selector
 * @returns {{promise: Promise<Element>, cancel: () => void}} `cancel` disconnects
 *   the observer if the element never shows up (e.g. the note type changed before
 *   it rendered) -- without it the observer would sit on document.body forever,
 *   matching whatever unrelated element next happens to fit the selector.
 */
function waitForElement(selector) {
  let observer = null;
  const promise = new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    observer = new MutationObserver((_, obs) => {
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

  return { promise, cancel: () => observer?.disconnect() };
}
