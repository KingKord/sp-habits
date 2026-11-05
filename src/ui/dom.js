// DOM access is scoped to an application instance. No globals or jQuery are needed.
export function createDOM(document, scope) {
  let pendingFocusKey = null;
  const cancelFocus = () => {
    pendingFocusKey = null;
  };
  scope.on(document, "pointerdown", cancelFocus);
  scope.on(document, "keydown", cancelFocus);
  function byId(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element: #${id}`);
    return element;
  }

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(text, action, label, className) {
    const element = node("button", text, className);
    element.type = "button";
    // Dynamic nodes own their listeners and are collected when removed.
    element.addEventListener("click", (event) => {
      if (!scope.disposed) action(event);
    });
    if (label) element.setAttribute("aria-label", label);
    return element;
  }

  function restoreFocus(key) {
    if (scope.disposed) return;
    if (key) pendingFocusKey = key;
    if (!pendingFocusKey) return;
    const element = [...document.querySelectorAll("[data-focus-key]")].find(
      (item) => item.dataset.focusKey === pendingFocusKey
    );
    element?.focus();
    // A refresh can temporarily disable the opener. Retry after the next render,
    // unless a new pointer or keyboard action has superseded this request.
    if (!element || document.activeElement === element) pendingFocusKey = null;
  }

  return {
    byId,
    node,
    button,
    restoreFocus,
    isActive: () => !scope.disposed,
    fragment: () => document.createDocumentFragment(),
    activeElement: () => document.activeElement,
    on: (id, type, handler) => scope.on(byId(id), type, handler)
  };
}
