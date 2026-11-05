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
