import { t } from "../i18n/index.js";
import { EditConflictError } from "../edit-session.js";
import {
  createGroup,
  renameGroup,
  removeGroup,
  moveGroup,
  setHabitGroup,
  validGroupName
} from "../organization.js";

export function createOrganizationControls({ dom, commit, render, confirm, newId }) {
  const { node, button, byId } = dom;
  const names = new Map();
  const rows = new Map();
  let newName = "",
    creating = false,
    newComposing = false,
    currentState = null,
    currentDisabled = true;
  function input(value, key, label, update) {
    const field = node("input");
    field.value = value;
    field.required = true;
    field.maxLength = 80;
    field.dataset.focusKey = key;
    field.setAttribute("aria-label", label);
    field.addEventListener("input", () => update(field.value));
    return field;
  }
  function checkName(state, value, id) {
    if (
      !validGroupName(value.trim()) ||
      (state.groups ?? []).some((group) => group.id !== id && group.name === value.trim())
    ) {
      byId("group-error").textContent = t(
        "Choose a unique group name of 1–80 characters without line breaks."
      );
      return false;
    }
    byId("group-error").textContent = "";
    return true;
  }
  function groupRow(id) {
    const record = { group: null, disabled: true, removed: false, saving: false, composing: false };
    const row = node("form", undefined, "group-controls");
    const field = input("", "group-name-" + id, "", (value) => {
      names.set(id, { value, expected: names.get(id)?.expected ?? record.group.name });
      cancel.hidden = false;
    });
    field.addEventListener("compositionstart", () => {
      record.composing = true;
      names.set(id, {
        value: field.value,
        expected: names.get(id)?.expected ?? record.group.name
      });
      cancel.hidden = false;
    });
    field.addEventListener("compositionend", () => {
      record.composing = false;
      names.set(id, { value: field.value, expected: names.get(id)?.expected ?? record.group.name });
      render();
    });
    const save = button(t("Rename"), () => {});
    save.type = "submit";
    const cancel = button(t("Cancel rename"), () => {
      names.delete(id);
      field.value = record.group.name;
      byId("group-error").textContent = "";
      render();
      if (!record.removed) dom.restoreFocus("group-name-" + id);
    });
    cancel.dataset.focusKey = "group-cancel-" + id;
    const missing = node("small", t("This group no longer exists."));
    const moves = [-1, 1].map((offset) => {
      const text = offset < 0 ? t("Move up") : t("Move down");
      const control = button(text, () => {
        if (!record.disabled) void commit((latest) => moveGroup(latest, id, offset));
      });
      control.dataset.focusKey = "group-move-" + id + "-" + offset;
      return control;
    });
    const remove = button(t("Remove group"), async () => {
      if (
        record.disabled ||
        record.removed ||
        !confirm(
          t("Remove group “") +
            record.group.name +
            t("”? Its habits and history will remain Ungrouped.")
        )
      )
        return;
      if (await commit((latest) => removeGroup(latest, id))) {
        names.delete(id);
        render();
      }
    });
    row.append(field, save, cancel, missing, ...moves, remove);
    row.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (
        record.disabled ||
        record.saving ||
        !row.reportValidity() ||
        !checkName(currentState, field.value, id)
      )
        return;
      const expected = names.get(id)?.expected ?? record.group.name;
      const value = field.value;
      record.saving = true;
      field.disabled = true;
      const ok = await commit((latest) => {
        if (latest.groups?.find((entry) => entry.id === id)?.name !== expected) {
          const message = t(
            "This group changed while you were editing. Your input is kept. Cancel the rename to review the latest name."
          );
          byId("group-error").textContent = message;
          throw new EditConflictError(message);
        }
        return renameGroup(latest, id, value);
      });
      record.saving = false;
      if (ok) names.delete(id);
      render();
    });
    return Object.assign(record, { row, field, save, cancel, missing, moves, remove });
  }
  const create = node("form", undefined, "group-controls");
  const newLabel = node("label", t("New group"));
  const newField = input("", "new-group", t("New group"), (value) => {
    newName = value;
  });
  newField.addEventListener("compositionstart", () => {
    newComposing = true;
  });
  newField.addEventListener("compositionend", () => {
    newComposing = false;
    newName = newField.value;
    render();
  });
  newLabel.append(newField);
  const add = button(t("Add group"), () => {});
  add.type = "submit";
  create.append(newLabel, add);
  create.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
      currentDisabled ||
      creating ||
      !create.reportValidity() ||
      !checkName(currentState, newField.value)
    )
      return;
    const value = newField.value;
    const id = newId();
    creating = true;
    newField.disabled = true;
    const ok = await commit((latest) => createGroup(latest, id, value));
    creating = false;
    if (ok) newName = "";
    render();
  });
  function management(state, disabled, visible) {
    byId("organization").hidden = !visible;
    currentState = state;
    currentDisabled = disabled;
    if (!visible) return;
    const groups = [...(state.groups ?? [])];
    const currentIds = new Set(groups.map((group) => group.id));
    for (const [id, draft] of names)
      if (!currentIds.has(id)) groups.push({ id, name: draft.expected });
    const desired = [];
    for (const [index, group] of groups.entries()) {
      let record = rows.get(group.id);
      if (!record) {
        record = groupRow(group.id);
        rows.set(group.id, record);
      }
      const { row, field, save, cancel, missing, moves, remove } = record;
      record.group = group;
      record.disabled = disabled;
      record.removed = !currentIds.has(group.id);
      const value = names.get(group.id)?.value ?? group.name;
      if (!record.composing && field.value !== value) field.value = value;
      field.setAttribute("aria-label", t("Group name: ") + group.name);
      // Background reads disable mutations, not the editor holding the user's draft.
      field.disabled = record.saving;
      save.disabled = cancel.disabled = disabled || record.saving;
      cancel.hidden = !names.has(group.id);
      missing.hidden = !record.removed;
      for (const [i, offset] of [-1, 1].entries()) {
        moves[i].disabled = disabled || record.removed || !(state.groups ?? [])[index + offset];
        moves[i].setAttribute(
          "aria-label",
          (offset < 0 ? t("Move up") : t("Move down")) + ": " + group.name
        );
      }
      remove.disabled = disabled || record.removed;
      remove.setAttribute("aria-label", t("Remove group: ") + group.name);
      desired.push(row);
    }
    for (const id of rows.keys()) if (!groups.some((group) => group.id === id)) rows.delete(id);
    if (!newComposing && newField.value !== newName) newField.value = newName;
    newField.disabled = creating || (state.groups ?? []).length >= 100;
    add.disabled = disabled || newField.disabled;
    desired.push(create);
    const root = byId("group-manager");
    if (
      desired.length === root.children.length &&
      desired.every((row, i) => row === root.children[i])
    )
      return;
    if (newComposing || [...rows.values()].some((record) => record.composing)) return;
    // Keep unchanged inputs attached, preserving selection, scroll and active composition.
    if (root.insertBefore) {
      for (const [index, row] of desired.entries())
        if (root.children[index] !== row) root.insertBefore(row, root.children[index] ?? null);
      while (root.children.length > desired.length) root.removeChild(root.lastElementChild);
    } else root.replaceChildren(...desired);
  }
  function membership(habit, state, disabled) {
    const label = node("label", t("Group"));
    const select = node("select");
    const empty = node("option", t("Ungrouped"));
    empty.value = "";
    select.append(empty);
    for (const group of state.groups ?? []) {
      const option = node("option", group.name);
      option.value = group.id;
      select.append(option);
    }
    select.value = habit.groupId ?? "";
    select.disabled = disabled;
    select.dataset.focusKey = habit.id + "-group";
    select.setAttribute("aria-label", t("Group: ") + habit.name);
    select.addEventListener("change", () => {
      void commit((latest) => setHabitGroup(latest, habit.id, select.value || null));
    });
    label.append(select);
    return label;
  }
  return { management, membership };
}
