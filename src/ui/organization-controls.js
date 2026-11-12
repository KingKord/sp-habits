import { t } from "../i18n/index.js";
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
  let newName = "";
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
  function management(state, disabled, visible) {
    byId("organization").hidden = !visible;
    if (!visible) return;
    const content = dom.fragment();
    for (const [index, group] of (state.groups ?? []).entries()) {
      const row = node("form", undefined, "group-controls");
      const field = input(
        names.get(group.id) ?? group.name,
        "group-name-" + group.id,
        t("Group name: ") + group.name,
        (value) => names.set(group.id, value)
      );
      const save = button(t("Rename"), () => {});
      save.type = "submit";
      row.append(field, save);
      row.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (disabled || !row.reportValidity() || !checkName(state, field.value, group.id)) return;
        const ok = await commit((latest) => renameGroup(latest, group.id, field.value));
        if (ok) {
          names.delete(group.id);
          render();
        }
      });
      for (const [offset, text] of [
        [-1, t("Move up")],
        [1, t("Move down")]
      ]) {
        const move = button(
          text,
          () => {
            void commit((latest) => moveGroup(latest, group.id, offset));
          },
          text + ": " + group.name
        );
        move.dataset.focusKey = "group-move-" + group.id + "-" + offset;
        move.disabled = disabled || !(state.groups ?? [])[index + offset];
        row.append(move);
      }
      const remove = button(
        t("Remove group"),
        async () => {
          if (
            !confirm(
              t("Remove group “") +
                group.name +
                t("”? Its habits and history will remain Ungrouped.")
            )
          )
            return;
          if (await commit((latest) => removeGroup(latest, group.id))) {
            names.delete(group.id);
            render();
          }
        },
        t("Remove group: ") + group.name
      );
      remove.disabled = field.disabled = save.disabled = disabled;
      row.append(remove);
      content.append(row);
    }
    const create = node("form", undefined, "group-controls");
    const label = node("label", t("New group"));
    const field = input(newName, "new-group", t("New group"), (value) => {
      newName = value;
    });
    label.append(field);
    const add = button(t("Add group"), () => {});
    add.type = "submit";
    field.disabled = add.disabled = disabled || (state.groups ?? []).length >= 100;
    create.append(label, add);
    create.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (disabled || !create.reportValidity() || !checkName(state, field.value)) return;
      const id = newId();
      if (await commit((latest) => createGroup(latest, id, field.value))) {
        newName = "";
        render();
      }
    });
    content.append(create);
    byId("group-manager").replaceChildren(content);
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
