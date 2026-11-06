const ACE = {
  _FIELD_OVERRIDE_STYLE_BLOCK_ID: "ace-code-field-override-css",
  _FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_ID: "ace-code-field-override-substitute",

  onCodeNoteTypeLoad(referenceCodeFieldIndex) {
    const style = document.createElement("style");
    style.id = this._FIELD_OVERRIDE_STYLE_BLOCK_ID;
    const originalFieldElementSelector = `.note-editor .fields > :nth-child(${referenceCodeFieldIndex + 1}) .collapsible`;
    style.textContent = `
       ${originalFieldElementSelector} {
         display: none !important;
       }
     `;
    document.head.append(style);
    void waitForElement(originalFieldElementSelector).then((el) => {
      new window.CodeMirror.EditorView({
        parent: el.parentElement,
        extensions: [
          window.CodeMirror.basicSetup,
          window.CodeMirror.EditorView.editorAttributes.of({
            id: this._FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_ID,
          }),
        ],
      });
    });
  },

  onCodeNoteTypeUnload() {
    const styleBlock = document.getElementById(
      this._FIELD_OVERRIDE_STYLE_BLOCK_ID,
    );
    styleBlock?.remove();

    const substituteEl = document.getElementById(
      this._FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_ID,
    );
    substituteEl?.remove();
  },
};

window.__ACE__ = ACE;

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
