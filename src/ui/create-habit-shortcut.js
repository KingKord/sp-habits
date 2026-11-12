const MODIFIERS = ["ctrl", "alt", "meta", "shift"];
const RESERVED_PLAIN_KEYS = new Set([
  "enter",
  "return",
  "space",
  "spacebar",
  "tab",
  "escape",
  "esc",
  "backspace",
  "delete",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "home",
  "end",
  "pageup",
  "pagedown"
]);

// The host stores one combo, using Ctrl/Alt/Meta/Shift and physical key names.
// It has no alias/default-key facility for plugin shortcuts and no alternatives syntax.
export function parseHostShortcut(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 100) return null;
  if (
    [...value].some(
      (character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127
    )
  )
    return null;
  const label = value.trim();
  const plus = label === "+" || label.endsWith("++");
  const parts = (plus ? label.slice(0, -1) : label)
    .split("+")
    .map((part) => part.trim().toLowerCase());
  const key = plus ? "+" : parts.pop();
  if (plus && parts.at(-1) === "") parts.pop();
  if (
    !key ||
    MODIFIERS.includes(key) ||
    parts.some((part) => !MODIFIERS.includes(part)) ||
    new Set(parts).size !== parts.length
  )
    return null;
  if (
    key !== "+" &&
    !/^(?:[\p{L}\p{N}\p{P}\p{S}]|f(?:[1-9]|1[0-9]|2[0-4])|[a-z][a-z0-9]*)$/u.test(key)
  )
    return null;
  // An empty/unknown multi-word spelling must not accidentally become a shortcut.
  if (
    key.length > 1 &&
    !/^(?:f(?:[1-9]|1[0-9]|2[0-4])|arrow(?:up|down|left|right)|(?:pageup|pagedown|home|end|insert|delete|backspace|enter|space|tab|escape)|numpad\w+|bracketleft|bracketright|backslash|semicolon|quote|comma|period|slash|backquote|minus|equal)$/u.test(
      key
    )
  )
    return null;
  if (!parts.length && RESERVED_PLAIN_KEYS.has(key)) return null;
  return { label, key, modifiers: parts };
}

function hostKeyCode(code, layout) {
  if (code === "Equal") return "+";
  if (code === "Minus") return "-";
  const mapped = layout?.get(code);
  if (typeof mapped === "string" && mapped) return mapped.toLowerCase();
  return code
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .toLowerCase();
}

export function matchesHostShortcut(event, shortcut, layout = new Map()) {
  if (!shortcut || typeof event.code !== "string" || !event.code) return false;
  const flags = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
    shift: event.shiftKey
  };
  return (
    MODIFIERS.every((name) => !!flags[name] === shortcut.modifiers.includes(name)) &&
    hostKeyCode(event.code, layout) === shortcut.key
  );
}

function editable(element) {
  return !!(
    element?.isContentEditable ||
    element?.closest?.(
      'input, textarea, select, [role="textbox"], [role="combobox"], [role="spinbutton"]'
    )
  );
}

// Keyboard events stay in this iframe. Parent chrome and native Add Task remain untouched.
export function mountCreateHabitShortcut({
  window,
  loadShortcut,
  canOpen,
  open,
  onChange = () => {}
}) {
  const document = window.document;
  let disposed = false,
    generation = 0,
    shortcut = null,
    layout = new Map();
  const layoutReady = Promise.resolve().then(async () => {
    try {
      const candidate = await window.navigator?.keyboard?.getLayoutMap?.();
      if (candidate && typeof candidate.get === "function") layout = candidate;
    } catch {
      // Match the host's physical-code fallback when Keyboard API is unavailable.
    }
  });
  async function refresh() {
    if (disposed) return;
    const token = ++generation;
    let configured = null;
    try {
      [configured] = await Promise.all([loadShortcut(), layoutReady]);
    } catch {
      /* No guessed binding on a failed read. */
    }
    if (disposed || generation !== token) return;
    shortcut = parseHostShortcut(configured);
    onChange(shortcut?.label ?? null);
  }
  function handle(event) {
    if (
      disposed ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.getModifierState?.("AltGraph") ||
      document.hidden ||
      document.hasFocus?.() === false
    )
      return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    if (
      path.some(editable) ||
      editable(document.activeElement) ||
      document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
    )
      return;
    if (!matchesHostShortcut(event, shortcut, layout) || !canOpen()) return;
    try {
      if (open() === false) return;
    } catch {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
  const focus = () => {
    void refresh();
  };
  document.addEventListener("keydown", handle);
  window.addEventListener("focus", focus);
  const ready = refresh();
  return {
    ready,
    refresh,
    label: () => shortcut?.label ?? null,
    dispose() {
      disposed = true;
      generation++;
      document.removeEventListener("keydown", handle);
      window.removeEventListener("focus", focus);
    }
  };
}
