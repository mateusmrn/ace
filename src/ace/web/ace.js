const ACE = {
  _FIELD_OVERRIDE_STYLE_BLOCK_ID: 'ace-code-field-override-css',
  _FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_ID: 'ace-code-field-override-substitute',

  onCodeNoteTypeLoad(){
    // Inject CSS to hide the default UI element for the `Code` field input.
    // Assumes that it is the first child element. Needs to be improved.
     const style = document.createElement('style');
     style.id = this._FIELD_OVERRIDE_STYLE_BLOCK_ID;
     style.textContent = `
       .note-editor .fields > :first-child .collapsible {
         display: none !important;
       }
     `
     document.head.append(style);
    // Add the substitute element as soon as the original one is added to the page
     void waitForElement('.note-editor .fields > :first-child .collapsible')
         .then((el) => {
             const sibling = document.createElement('span');
             sibling.id = this._FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_ID;
             sibling.textContent = 'test sibling';
             el.after(sibling);
         });

  },

  onCodeNoteTypeUnload(){
    const styleBlock = document.getElementById(this._FIELD_OVERRIDE_STYLE_BLOCK_ID);
    styleBlock?.remove();

    const substituteEl = document.getElementById(this._FIELD_OVERRIDE_SUBSTITUTE_ELEMENT_ID);
    substituteEl?.remove();
  }
}

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
             subtree: true
         });
     });
 }


