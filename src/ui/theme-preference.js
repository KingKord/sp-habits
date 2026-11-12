const THEME_KEY = "habits-theme-v1";
const explicitTheme = (value) => value === "light" || value === "dark";

// Preferences stay separate from synced habit history and are optional when storage is unavailable.
export function createThemePreference(window, onStorageError = () => {}) {
  const root = window.document.documentElement;
  let value = "auto";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (explicitTheme(stored)) value = stored;
  } catch {
    // The current view can still change its appearance without persistent browser storage.
  }
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  let hostBody = null;
  try {
    if (window.parent !== window) hostBody = window.parent.document.body;
  } catch {
    // Opaque hosts can still supply the injected theme flag.
  }
  function hostTheme() {
    const injected = window.getComputedStyle(root).getPropertyValue("--is-dark-theme").trim();
    if (hostBody && ["0", "1"].includes(injected))
      return hostBody.classList.contains("isDarkTheme") ? "dark" : "light";
    if (["0", "1"].includes(injected)) return injected === "1" ? "dark" : "light";
    return media?.matches ? "dark" : "light";
  }
  function apply() {
    root.dataset.theme = explicitTheme(value) ? value : hostTheme();
  }
  apply();
  media?.addEventListener?.("change", apply);
  const observers = [];
  if (window.MutationObserver) {
    if (hostBody) {
      const observer = new window.MutationObserver(apply);
      observer.observe(hostBody, { attributes: true, attributeFilter: ["class", "style"] });
      observers.push(observer);
    }
    const injected = window.document.getElementById("injected-theme-vars");
    if (injected) {
      const observer = new window.MutationObserver(apply);
      observer.observe(injected, { childList: true, characterData: true, subtree: true });
      observers.push(observer);
    }
  }
  return {
    value: () => value,
    set(next) {
      value = explicitTheme(next) ? next : "auto";
      apply();
      try {
        if (value === "auto") window.localStorage.removeItem(THEME_KEY);
        else window.localStorage.setItem(THEME_KEY, value);
      } catch {
        onStorageError();
      }
    },
    dispose() {
      media?.removeEventListener?.("change", apply);
      for (const observer of observers) observer.disconnect();
    }
  };
}
