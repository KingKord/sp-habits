const STORAGE_KEY = "habits-collapsed-groups-v1";
const validId = (id) => typeof id === "string" && /^(?:[a-zA-Z0-9_-]{1,100})?$/.test(id);

// Display preferences stay separate from habit visibility, history and synced backups.
export function createGroupCollapse(window, onStorageError = () => {}) {
  let collapsed = new Set();
  try {
    const stored = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(stored) && stored.length <= 101 && stored.every(validId))
      collapsed = new Set(stored);
  } catch {
    // Restricted or malformed preference storage must not prevent rendering habits.
  }
  return {
    isCollapsed: (id) => collapsed.has(id),
    retain(ids) {
      const current = new Set(ids);
      for (const id of collapsed) if (!current.has(id)) collapsed.delete(id);
    },
    toggle(id) {
      if (!validId(id)) return;
      if (collapsed.has(id)) collapsed.delete(id);
      else collapsed.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed].sort()));
      } catch {
        onStorageError();
      }
    }
  };
}
