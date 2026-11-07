class AceExtension {
  static #FIELD_OVERRIDE_STYLE_BLOCK_ID = "ace-code-field-override-css";
  static #FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS =
    "ace-code-field-override-substitute";

  /**
   * @typedef {object} FieldOverrideConfig
   *  @property {number} index - The index of the position of the field in the form
   */

  /**
   * @param {FieldOverrideConfig[]} fieldsOverrideConfig
   */
  onCodeNoteTypeLoad(fieldsOverrideConfig) {
    const fieldsCssSelectors = fieldsOverrideConfig.map(
      (config) =>
        `.note-editor .fields > :nth-child(${config.index + 1}) .collapsible`,
    );
    this.#hideOverriddenFieldsDefaultUiElements(fieldsCssSelectors);
    this.addOverridenFieldsSubstituteUiElements(fieldsCssSelectors);
  }

  /**
   * @param {string[]} fieldsCssSelectors
   */
  #hideOverriddenFieldsDefaultUiElements(fieldsCssSelectors) {
    const style = document.createElement("style");
    style.id = AceExtension.#FIELD_OVERRIDE_STYLE_BLOCK_ID;
    style.textContent = `
      ${fieldsCssSelectors.join(",")} {
         display: none !important;
       }
     `;
    console.log(style.textContent);
    document.head.append(style);
  }

  /**
   * @param {string[]} fieldsCssSelectors
   */
  addOverridenFieldsSubstituteUiElements(fieldsCssSelectors) {
    fieldsCssSelectors.forEach((selector) => {
      void waitForElement(selector).then((el) => {
        new window.CodeMirror.EditorView({
          parent: el.parentElement,
          extensions: [
            window.CodeMirror.basicSetup,
            window.CodeMirror.EditorView.editorAttributes.of({
              class: AceExtension.#FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_CLASS,
            }),
          ],
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
