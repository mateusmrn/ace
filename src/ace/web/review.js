class AceReviewExtension {
  static #INPUT_ID = "ace-review-input";
  static #SUBMIT_ID = "ace-review-submit";
  static #SPINNER_ID = "ace-review-spinner";
  static #RESULT_ID = "ace-review-result";

  #spinner = null;
  #resultEl = null;
  #submitButton = null;

  constructor() {
    this.#watchForCard();
  }

  #watchForCard() {
    void waitForElement(`#${AceReviewExtension.#INPUT_ID}`).then((el) => {
      this.#mount(el);
      // the next ACE Code card replaces this element wholesale; watch for it too
      this.#watchForCard();
    });
  }

  #mount(inputContainer) {
    const view = new window.CodeMirror.EditorView({
      parent: inputContainer,
      extensions: [window.CodeMirror.basicSetup],
    });

    this.#submitButton = document.getElementById(AceReviewExtension.#SUBMIT_ID);
    this.#spinner = document.getElementById(AceReviewExtension.#SPINNER_ID);
    this.#resultEl = document.getElementById(AceReviewExtension.#RESULT_ID);

    this.#submitButton.addEventListener("click", () => {
      this.#resultEl.classList.add("ace-hidden");
      this.#spinner.classList.remove("ace-hidden");
      this.#submitButton.disabled = true;

      const inputCode = view.state.doc.toString();
      pycmd(`ace_run:${JSON.stringify({ inputCode })}`);
    });
  }

  /**
   * @param {{status: "success"} | {status: "failure", referenceOutput: string, inputOutput: string} | {status: "error", message: string}} result
   */
  onResult(result) {
    this.#spinner.classList.add("ace-hidden");
    this.#submitButton.disabled = false;

    this.#resultEl.classList.remove("ace-hidden");
    this.#resultEl.classList.remove(
      "ace-result-success",
      "ace-result-failure",
      "ace-result-error",
    );
    this.#resultEl.replaceChildren();

    if (result.status === "success") {
      this.#resultEl.classList.add("ace-result-success");
      this.#resultEl.textContent = "Success -- your output matches the reference.";
      return;
    }

    if (result.status === "failure") {
      this.#resultEl.classList.add("ace-result-failure");
      this.#resultEl.append(
        AceReviewExtension.#textNode("p", "Output differs from the reference."),
        AceReviewExtension.#textNode("p", "Reference output:"),
        AceReviewExtension.#textNode("pre", result.referenceOutput),
        AceReviewExtension.#textNode("p", "Your output:"),
        AceReviewExtension.#textNode("pre", result.inputOutput),
      );
      return;
    }

    this.#resultEl.classList.add("ace-result-error");
    this.#resultEl.append(
      AceReviewExtension.#textNode("p", `Error: ${result.message}`),
    );
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
