// Only a press and release on the backdrop dismisses a dialog. Dragging out of a field does not.
export function closeOnBackdrop(dom, id, close) {
  const dialog = dom.byId(id);
  let startedOutside = false;
  const outside = (event) => {
    if (event.target !== dialog) return false;
    const box = dialog.getBoundingClientRect();
    return (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    );
  };
  dom.on(id, "pointerdown", (event) => {
    startedOutside = outside(event);
  });
  dom.on(id, "pointercancel", () => {
    startedOutside = false;
  });
  dom.on(id, "click", (event) => {
    const dismiss = startedOutside && outside(event);
    startedOutside = false;
    if (dismiss) close();
  });
}

// Return finishes a single-line field without submitting or discarding the form.
export function dismissKeyboardOnReturn(dom, id) {
  dom.on(id, "keydown", (event) => {
    const input = event.target;
    if (
      event.key !== "Enter" ||
      event.isComposing ||
      event.keyCode === 229 ||
      input?.tagName !== "INPUT" ||
      !["text", "search", "number", "time", "date"].includes(input.type)
    )
      return;
    event.preventDefault();
    input.blur();
  });
}
