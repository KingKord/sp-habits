import { t } from "../i18n/index.js";

const DRAFT_KEY = "habits-editor-drafts-v1";
const MAX_DRAFT_LENGTH = 262144;
const kinds = ["habit", "count", "plan", "note"];

export function createDraftStorage(window) {
  let saved = null;
  let unreadable = false;
  let raw = "";
  try {
    raw = window.sessionStorage.getItem(DRAFT_KEY) || "";
    if (raw) {
      if (raw.length > MAX_DRAFT_LENGTH) throw new Error("Draft too large");
      const parsed = JSON.parse(raw);
      if (
        parsed?.schemaVersion !== 1 ||
        !parsed.editors ||
        typeof parsed.editors !== "object" ||
        Array.isArray(parsed.editors)
      )
        throw new Error("Invalid draft envelope");
      for (const [key, draft] of Object.entries(parsed.editors)) {
        if (
          !kinds.includes(key) ||
          draft?.kind !== key ||
          !draft.context ||
          !Array.isArray(draft.fields)
        )
          throw new Error("Invalid editor draft");
        if (
          draft.fields.length > 512 ||
          draft.fields.some(
            (field) =>
              !Number.isInteger(field.index) ||
              typeof field.id !== "string" ||
              typeof field.value !== "string" ||
              field.id.length > 100 ||
              field.value.length > 4096
          )
        )
          throw new Error("Invalid draft fields");
      }
      saved = parsed.editors;
    }
  } catch {
    unreadable = !!raw;
  }
  return {
    read: () => ({ editors: saved, unreadable, raw }),
    save(editors) {
      const text = Object.keys(editors).length ? JSON.stringify({ schemaVersion: 1, editors }) : "";
      if (text.length > MAX_DRAFT_LENGTH) return false;
      try {
        if (text) window.sessionStorage.setItem(DRAFT_KEY, text);
        else window.sessionStorage.removeItem(DRAFT_KEY);
        saved = text ? editors : null;
        raw = text;
        unreadable = false;
        return true;
      } catch {
        return false;
      }
    }
  };
}

// Session drafts are offered explicitly, never applied to confirmed habit storage automatically.
export function mountDraftRecovery({ window, dom, scope, editors, ready }) {
  const storage = createDraftStorage(window);
  const stored = storage.read();
  let pending = stored.editors || {};
  let unreadable = stored.unreadable;
  let restoring = false;
  let storageWarning = false;
  const { node, button } = dom;
  const dialog = node("dialog", undefined, "saved-drafts");
  dialog.id = "saved-drafts";
  dialog.setAttribute("aria-labelledby", "saved-drafts-title");
  const title = node("h2", t("Unsaved changes available"));
  title.id = "saved-drafts-title";
  const description = node(
    "p",
    t(
      "Unsaved changes were kept in this tab. Resume them after reviewing the latest data, or discard them."
    )
  );
  const error = node("p", "", "form-error");
  error.setAttribute("role", "alert");
  const text = node("textarea");
  text.readOnly = true;
  text.hidden = true;
  text.setAttribute("aria-label", t("Saved draft text"));
  const warning = node("p", "", "draft-storage-warning");
  warning.hidden = true;
  warning.setAttribute("role", "status");
  const actions = node("div", undefined, "dialog-bottom");
  const resume = button(t("Resume saved drafts"), () => {
    void restore();
  });
  resume.className = "btn-primary";
  const discard = button(t("Discard saved drafts"), () => {
    const ok = storage.save(capture());
    if (!ok) {
      showWarning(true);
      error.textContent = t(
        "Unable to discard saved drafts. Storage is unavailable. Copy the text or try again."
      );
      text.value = stored.raw || JSON.stringify(pending, null, 2);
      text.hidden = false;
      return;
    }
    pending = {};
    unreadable = false;
    showWarning(false);
    dialog.close();
  });
  actions.append(discard, resume);
  dialog.append(title, description, error, text, actions);
  window.document.body.append(dialog);
  window.document.querySelector(".shell").prepend(warning);
  scope.on(dialog, "cancel", (event) => event.preventDefault());

  function capture() {
    const captures = {};
    for (const key of kinds) {
      const draft = editors[key].captureDraft();
      if (draft) captures[key] = draft;
    }
    return captures;
  }
  function showWarning(visible) {
    storageWarning = visible;
    warning.hidden = !visible;
    warning.textContent = visible
      ? t("Draft storage is unavailable. Keep this view open or save your changes before leaving.")
      : "";
  }
  function persist() {
    if (restoring || unreadable) return;
    // Pending drafts are not replaced by an unrelated render before the user chooses Resume/Discard.
    const drafts = { ...capture(), ...pending };
    const ok = storage.save(drafts);
    showWarning(!ok && (Object.keys(drafts).length > 0 || !!storage.read().raw || storageWarning));
  }
  function offer() {
    if ((!unreadable && !Object.keys(pending).length) || !ready() || dialog.open) return;
    if (window.document.querySelector("dialog[open]")) return;
    if (unreadable) showUnrestorable(stored.raw);
    dialog.showModal();
    (unreadable ? discard : resume).focus();
  }
  function showUnrestorable(raw) {
    error.textContent = t(
      "Some drafts could not be reopened. Their text is kept below so you can copy it before discarding."
    );
    text.value = raw;
    text.hidden = false;
    resume.disabled = true;
  }
  async function restore() {
    if (restoring || !ready()) return;
    restoring = true;
    resume.disabled = discard.disabled = true;
    const remaining = { ...pending };
    try {
      for (const key of kinds) {
        if (!remaining[key]) continue;
        try {
          const restored = await editors[key].restoreDraft(remaining[key]);
          if (scope.disposed) return;
          if (restored) delete remaining[key];
        } catch {
          // An invalid/deleted context remains recoverable as plain text, not an implicit new habit.
        }
      }
      if (scope.disposed) return;
      pending = remaining;
      if (Object.keys(remaining).length) {
        showUnrestorable(JSON.stringify(remaining, null, 2));
        discard.textContent = t("Discard unavailable drafts");
        dialog.close();
        dialog.showModal();
      } else {
        dialog.close();
      }
    } finally {
      restoring = false;
      if (!scope.disposed) {
        discard.disabled = false;
        if (!Object.keys(remaining).length) resume.disabled = false;
        persist();
      }
    }
  }
  const remember = (event) => {
    if (scope.disposed || dialog.contains(event.target)) return;
    persist();
  };
  for (const type of ["input", "change", "click", "submit"])
    scope.on(window.document, type, remember);
  window.document.addEventListener("close", remember, true);
  scope.add(() => window.document.removeEventListener("close", remember, true));
  scope.add(() => {
    dialog.remove();
    warning.remove();
  });
  return {
    offer,
    persist,
    hasDrafts: () =>
      unreadable || Object.keys(pending).length > 0 || Object.keys(capture()).length > 0
  };
}
