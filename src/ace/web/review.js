// review.js can be re-injected/re-executed for a later card before an earlier
// execution's pending waitForElement() ever resolves (e.g. if the reviewer sets
// fresh page content per card rather than just swapping DOM). Each execution
// claims the current generation; a watcher only acts if its generation is still
// the latest one by the time it resolves, so a stale execution can't mount a
// second CodeMirror editor on top of the current one.
const aceReviewGeneration = (window.__ACE_REVIEW_GENERATION__ =
  (window.__ACE_REVIEW_GENERATION__ ?? 0) + 1);

class AceReviewExtension {
  static #INPUT_ID = "ace-review-input";
  static #SPINNER_ID = "ace-review-spinner";
  static #RESULT_ID = "ace-review-result";

  constructor() {
    this.#watchForCard();
  }

  #watchForCard() {
    void waitForElement(`#${AceReviewExtension.#INPUT_ID}`).then((el) => {
      if (window.__ACE_REVIEW_GENERATION__ !== aceReviewGeneration) {
        return; // a newer execution of this script has taken over
      }
      this.#mount(el);
      // `el` stays in the DOM (we mounted CodeMirror inside it, not over it), so
      // re-arming immediately would just find it again and mount a second editor
      // into it -- on and on, forever. Wait for it to actually be removed (the
      // next card replacing it) before watching for the next one.
      void waitForRemoval(el).then(() => this.#watchForCard());
    });
  }

  #mount(inputContainer) {
    new window.CodeMirror.EditorView({
      parent: inputContainer,
      extensions: [
        window.CodeMirror.basicSetup,
        window.CodeMirror.darcula,
        // basicSetup deliberately leaves Tab unbound so keyboard users aren't
        // trapped in the editor. Code answers need real indentation though, so
        // bind it here -- Escape first, then Tab, still releases focus.
        window.CodeMirror.keymap.of([window.CodeMirror.indentWithTab]),
        window.CodeMirror.EditorView.updateListener.of((viewUpdate) => {
          if (viewUpdate.docChanged) {
            const inputCode = viewUpdate.state.doc.toString();
            pycmd(`ace_input_changed:${JSON.stringify({ inputCode })}`);
          }
        }),
      ],
    });
  }

  /**
   * Called by Python once the comparison for the card just answered finishes.
   * This runs on the answer side, which is a different render than the one
   * #mount() ran on, so it looks up its elements fresh rather than reusing
   * anything cached from #mount().
   * @param {{status: "success"} | {status: "failure", referenceOutput: string, inputOutput: string} | {status: "error", message: string}} result
   */
  onResult(result) {
    const spinner = document.getElementById(AceReviewExtension.#SPINNER_ID);
    const resultEl = document.getElementById(AceReviewExtension.#RESULT_ID);
    if (!spinner || !resultEl) {
      return; // the user has already moved past this card
    }

    spinner.classList.add("ace-hidden");

    resultEl.classList.remove("ace-hidden");
    resultEl.classList.remove(
      "ace-result-success",
      "ace-result-failure",
      "ace-result-error",
    );
    resultEl.replaceChildren();

    if (result.status === "success") {
      resultEl.classList.add("ace-result-success");
      resultEl.textContent = "Success -- your output matches the reference.";
      return;
    }

    if (result.status === "failure") {
      resultEl.classList.add("ace-result-failure");
      resultEl.append(
        AceReviewExtension.#textNode("p", "Output differs from the reference."),
        AceReviewExtension.#textNode("p", "Reference output:"),
        AceReviewExtension.#textNode("pre", result.referenceOutput),
        AceReviewExtension.#textNode("p", "Your output:"),
        AceReviewExtension.#textNode("pre", result.inputOutput),
      );
      return;
    }

    resultEl.classList.add("ace-result-error");
    resultEl.append(AceReviewExtension.#textNode("p", `Error: ${result.message}`));
  }

  static #textNode(tagName, text) {
    const el = document.createElement(tagName);
    el.textContent = text;
    return el;
  }
}

window.__ACE_REVIEW__ = new AceReviewExtension();

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

function waitForRemoval(element) {
  return new Promise((resolve) => {
    if (!document.body.contains(element)) {
      return resolve();
    }

    const observer = new MutationObserver((_, obs) => {
      if (!document.body.contains(element)) {
        obs.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}
