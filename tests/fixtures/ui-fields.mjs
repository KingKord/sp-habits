export function fieldsHarness(ids) {
  const elements = [];
  class Element extends EventTarget {
    constructor(tag, text = "") {
      super();
      this.tag = tag;
      this.textContent = text;
      this.children = [];
      this.value = "";
      this.hidden = false;
      this.disabled = false;
      this.checked = false;
    }
    append(...children) {
      this.children.push(...children);
      if (this.tag === "select" && !this.value && children.length) this.value = children[0].value;
    }
    replaceChildren(...children) {
      this.children = [];
      this.append(...children);
    }
    get options() {
      return this.children;
    }
    setCustomValidity(message) {
      this.error = message;
    }
    setAttribute() {}
    checkValidity() {
      return (
        !this.error &&
        (!this.value ||
          ((!this.min || this.value >= this.min) && (!this.max || this.value <= this.max)))
      );
    }
    reportValidity() {
      return this.checkValidity();
    }
  }
  const node = (tag, text) => {
    const element = new Element(tag, text);
    elements.push(element);
    return element;
  };
  const byId = (id) => elements.find((element) => element.id === id);
  for (const id of ids) node("div").id = id;
  const dom = {
    node,
    byId,
    button: (text, action) => {
      const element = node("button", text);
      element.addEventListener("click", action);
      return element;
    }
  };
  const find = (root, text) =>
    [root, ...root.children.flatMap((child) => collect(child))].find(
      (element) => element.textContent === text
    );
  function collect(root) {
    return [root, ...root.children.flatMap((child) => collect(child))];
  }
  return {
    dom,
    byId,
    elements,
    find,
    send: (element, type = "change") => element.dispatchEvent(new Event(type))
  };
}
