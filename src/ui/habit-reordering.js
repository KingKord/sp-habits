import { t } from "../i18n/index.js";

// Only handles start a drag; scrolling or using a counter never changes order.
export function createHabitReordering({ dom, move, flash }) {
  const { byId, node, button, on } = dom;
  const container = byId("cards");
  const document = container.ownerDocument;
  const view = document.defaultView;
  let drag = null;
  let openMenu = null;
  let frame = null;

  function closeMenu(restoreFocus = false) {
    if (!openMenu) return;
    const previous = openMenu;
    openMenu = null;
    previous.menu.open = false;
    document.removeEventListener?.("pointerdown", outsideMenu);
    document.removeEventListener?.("keydown", escapeMenu);
    if (restoreFocus) previous.trigger.focus();
  }
  function outsideMenu(event) {
    if (openMenu && !openMenu.menu.contains(event.target)) closeMenu();
  }
  function escapeMenu(event) {
    if (event.key !== "Escape" || !openMenu) return;
    event.preventDefault();
    closeMenu(true);
  }
  function clearTarget() {
    container.querySelectorAll(".drop-before, .drop-after").forEach((row) => {
      row.classList.remove("drop-before", "drop-after");
    });
  }
  function cancel() {
    closeMenu();
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    clearTarget();
    if (!drag) return;
    const previous = drag;
    drag = null;
    previous.row.classList.remove("habit-dragging");
    if (previous.handle.hasPointerCapture(previous.pointerId))
      previous.handle.releasePointerCapture(previous.pointerId);
  }
  function targetAtPointer() {
    clearTarget();
    drag.target = null;
    const row = document.elementFromPoint(drag.x, drag.y)?.closest(".habit-row");
    if (
      !row ||
      !container.contains(row) ||
      row === drag.row ||
      row.dataset.groupId !== drag.row.dataset.groupId
    )
      return;
    const bounds = row.getBoundingClientRect();
    const placement = drag.y < bounds.top + bounds.height / 2 ? "before" : "after";
    row.classList.add("drop-" + placement);
    drag.target = { id: row.dataset.habitId, placement };
  }
  function scroll() {
    frame = null;
    if (!drag?.active) return;
    const edge = 48;
    const distance =
      drag.y < edge
        ? drag.y - edge
        : drag.y > view.innerHeight - edge
          ? drag.y - view.innerHeight + edge
          : 0;
    if (distance) {
      view.scrollBy(0, Math.max(-14, Math.min(14, distance / 3)));
      targetAtPointer();
    }
    frame = view.requestAnimationFrame(scroll);
  }
  on("cards", "pointerdown", (event) => {
    const handle = event.target.closest(".habit-drag-handle");
    if (!handle || handle.disabled || event.button !== 0 || !event.isPrimary) return;
    cancel();
    const row = handle.closest(".habit-row");
    drag = {
      handle,
      row,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      target: null,
      active: false
    };
    handle.focus();
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  on("cards", "pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return;
    if (!drag.active) {
      drag.active = true;
      drag.row.classList.add("habit-dragging");
      flash(t("Moving: ") + drag.handle.dataset.habitName);
      frame = view.requestAnimationFrame(scroll);
    }
    targetAtPointer();
  });
  on("cards", "pointerup", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const source = drag.row.dataset.habitId;
    const groupId = drag.row.dataset.groupId;
    const target = drag.active ? drag.target : null;
    cancel();
    if (target) void move(source, target.id, target.placement, groupId, source + "-drag");
    else flash("");
  });
  for (const type of ["pointercancel", "lostpointercapture"])
    on("cards", type, () => {
      if (drag) {
        cancel();
        flash("");
      }
    });
  on("cards", "keydown", (event) => {
    if (event.key === "Escape" && drag) {
      cancel();
      flash(t("Reordering cancelled."));
      event.preventDefault();
    }
  });

  function controls(habit, peers, disabled) {
    const position = peers.findIndex((entry) => entry.id === habit.id);
    async function step(offset) {
      const target = peers[position + offset];
      if (target)
        await move(
          habit.id,
          target.id,
          offset < 0 ? "before" : "after",
          habit.groupId ?? "",
          habit.id + "-drag"
        );
    }
    const handle = button("⠿", () => {}, t("Drag to reorder: ") + habit.name, "habit-drag-handle");
    handle.disabled = disabled || peers.length < 2;
    handle.title = t("Drag to reorder. Use Up and Down arrow keys to move within this group.");
    handle.dataset.focusKey = habit.id + "-drag";
    handle.dataset.habitName = habit.name;
    handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
    handle.addEventListener("keydown", (event) => {
      if (handle.disabled || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      void step(event.key === "ArrowUp" ? -1 : 1);
    });
    const menu = node("details", undefined, "habit-reorder-menu");
    const trigger = node("summary", "⋯");
    trigger.setAttribute("aria-label", t("Reorder options: ") + habit.name);
    trigger.dataset.focusKey = habit.id + "-order-menu";
    trigger.setAttribute("aria-disabled", String(disabled));
    function trackMenu() {
      if (!menu.open) {
        if (openMenu?.menu === menu) closeMenu();
        return;
      }
      if (disabled) {
        menu.open = false;
        return;
      }
      if (openMenu?.menu === menu) return;
      closeMenu();
      openMenu = { menu, trigger };
      document.addEventListener?.("pointerdown", outsideMenu);
      document.addEventListener?.("keydown", escapeMenu);
    }
    trigger.addEventListener("click", (event) => {
      // Native toggle events are deferred. Register dismissal before the next key or pointer event.
      event.preventDefault();
      if (disabled) return;
      if (menu.open) {
        menu.open = false;
        if (openMenu?.menu === menu) closeMenu();
      } else {
        menu.open = true;
        trackMenu();
      }
    });
    menu.addEventListener("toggle", trackMenu);
    menu.append(trigger);
    const actions = node("div", undefined, "habit-reorder-actions");
    for (const [offset, label] of [
      [-1, t("Move up")],
      [1, t("Move down")]
    ]) {
      const control = button(
        (offset < 0 ? "↑ " : "↓ ") + label,
        () => {
          closeMenu();
          void step(offset);
        },
        label + ": " + habit.name
      );
      control.disabled = disabled || !peers[position + offset];
      actions.append(control);
    }
    menu.append(actions);
    return { handle, menu };
  }
  return { controls, cancel };
}
