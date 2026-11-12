import { t } from "../i18n/index.js";

export function validFieldDraft(fields) {
  return (
    Array.isArray(fields) &&
    fields.length <= 512 &&
    fields.every(
      (field) =>
        field &&
        typeof field === "object" &&
        Number.isInteger(field.index) &&
        field.index >= 0 &&
        field.index < 512 &&
        typeof field.id === "string" &&
        field.id.length <= 100 &&
        typeof field.value === "string" &&
        field.value.length <= 4096 &&
        (field.checked === undefined || typeof field.checked === "boolean")
    )
  );
}

// Keep raw field strings, including temporarily invalid or empty values.
export function captureFields(form) {
  return [...form.querySelectorAll("input, select, textarea")].map((field, index) => ({
    index,
    id: field.id || "",
    value: field.value,
    checked: field.type === "checkbox" ? field.checked : undefined,
    selectionStart: field.selectionStart,
    selectionEnd: field.selectionEnd,
    scrollLeft: field.scrollLeft,
    focused: form.ownerDocument?.activeElement === field
  }));
}

export function restoreFields(form, saved) {
  if (!validFieldDraft(saved)) return false;
  const fields = [...form.querySelectorAll("input, select, textarea")];
  for (const entry of saved) {
    const field = entry.id ? fields.find((item) => item.id === entry.id) : fields[entry.index];
    if (!field) continue;
    if (typeof entry.value === "string") field.value = entry.value;
    if (field.type === "checkbox" && typeof entry.checked === "boolean")
      field.checked = entry.checked;
    if (entry.focused === true && !field.disabled) field.focus();
    if (typeof entry.selectionStart === "number" && field.setSelectionRange) {
      try {
        field.setSelectionRange(entry.selectionStart, entry.selectionEnd);
      } catch {
        // Number and date controls do not support text selections.
      }
    }
    if (Number.isFinite(entry.scrollLeft)) field.scrollLeft = entry.scrollLeft;
  }
  return true;
}

export function createFormLock(form) {
  let controls = null;
  return (locked) => {
    if (locked && !controls) {
      controls = [...form.querySelectorAll("input, select, textarea, button")].map((field) => [
        field,
        field.disabled
      ]);
      for (const [field] of controls) field.disabled = true;
    } else if (!locked && controls) {
      for (const [field, disabled] of controls) field.disabled = disabled;
      controls = null;
    }
  };
}

// Reloading confirmed storage never replaces the draft or its conflict baseline.
export function createEditorRecovery({ dom, store, formId, saveIds, errorId, busy = () => false }) {
  const root = dom.node("div", undefined, "draft-recovery");
  root.setAttribute("role", "status");
  const message = dom.node("p");
  let reloading = false;
  const reload = dom.button(t("Reload data and keep editing"), async () => {
    if (busy() || reloading || store.snapshot().pending || store.snapshot().busyRead) return;
    reloading = true;
    refresh();
    const ok = await store.reload();
    reloading = false;
    if (!dom.isActive()) return;
    dom.byId(errorId).textContent = ok
      ? t(
          "Data reloaded. Review your draft before saving; changes from another device may need a new edit."
        )
      : store.snapshot().error;
    refresh();
  });
  root.append(message, reload);
  dom.byId(formId).append(root);
  function refresh() {
    const snapshot = store.snapshot();
    root.hidden = !snapshot.blocked;
    reload.disabled = busy() || reloading || snapshot.pending > 0 || snapshot.busyRead;
    message.textContent = t("Reload confirmed data to continue. Your unsaved input will be kept.");
    for (const id of saveIds)
      dom.byId(id).disabled =
        busy() || reloading || snapshot.blocked || snapshot.pending > 0 || snapshot.busyRead;
  }
  refresh();
  return { refresh };
}
