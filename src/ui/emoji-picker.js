import { t } from "../i18n/index.js";
import { validEmoji } from "../domain.js";
import { loadEmojiCatalog, searchEmoji, emojiName } from "./emoji-catalog.js";
import { closeOnBackdrop } from "./dialog.js";

export function createEmojiPicker({ dom, select, loadData, systemEmoji }) {
  const { byId, node, button, on } = dom;
  let groups = [],
    current = "",
    limit = 144,
    opening = 0;
  function close() {
    opening++;
    byId("emoji-picker").close();
    byId("choose-emoji").focus();
  }
  function choose(emoji) {
    select(emoji);
    close();
  }
  function render() {
    const entries = searchEmoji(groups, byId("emoji-search").value, byId("emoji-category").value);
    byId("emoji-results").replaceChildren(
      ...entries.slice(0, limit).map((entry) => {
        const [emoji] = entry,
          name = emojiName(entry);
        const item = button(emoji, () => choose(emoji), name + " " + emoji, "emoji-option");
        item.title = name;
        item.setAttribute("aria-pressed", String(emoji === current));
        return item;
      })
    );
    byId("emoji-results-status").textContent = entries.length
      ? t("Found: ") + entries.length
      : t("No results");
    byId("more-emoji").hidden = entries.length <= limit;
  }
  async function open(value) {
    const token = ++opening;
    current = value;
    limit = 144;
    byId("emoji-search").value = "";
    byId("emoji-custom").value = value;
    byId("emoji-picker-error").textContent = "";
    byId("emoji-category").value = "";
    byId("emoji-results").replaceChildren();
    byId("emoji-results-status").textContent = t("Loading…");
    byId("more-emoji").hidden = true;
    byId("open-system-emoji").hidden = true;
    byId("open-system-emoji").disabled = false;
    byId("emoji-picker").showModal();
    byId("emoji-search").focus();
    if (systemEmoji)
      void systemEmoji()
        .then((result) => {
          if (dom.isActive() && token === opening && byId("emoji-picker").open)
            byId("open-system-emoji").hidden = !result.available;
        })
        .catch(() => {});
    try {
      groups = await loadEmojiCatalog(loadData);
      if (!dom.isActive() || token !== opening || !byId("emoji-picker").open) return;
      byId("emoji-category").replaceChildren(
        newOption("", t("All categories")),
        ...groups.map((group) => newOption(group.id, group.name))
      );
      render();
    } catch {
      if (dom.isActive() && byId("emoji-picker").open)
        byId("emoji-results-status").textContent = t(
          "Unable to load the catalog. You can paste an emoji below."
        );
    }
  }
  function newOption(value, text) {
    const option = node("option", text);
    option.value = value;
    return option;
  }
  function useCustom() {
    const emoji = byId("emoji-custom").value.trim();
    if (!emoji || !validEmoji(emoji)) {
      byId("emoji-picker-error").textContent = t("Paste one emoji.");
      return;
    }
    choose(emoji);
  }
  on("close-emoji-picker", "click", close);
  closeOnBackdrop(dom, "emoji-picker", close);
  on("open-system-emoji", "click", async () => {
    const token = opening;
    byId("emoji-custom").focus();
    byId("emoji-custom").select();
    byId("open-system-emoji").disabled = true;
    try {
      await systemEmoji(true);
    } catch (error) {
      if (dom.isActive() && token === opening && byId("emoji-picker").open)
        byId("emoji-picker-error").textContent = error.message;
    } finally {
      if (dom.isActive() && token === opening) byId("open-system-emoji").disabled = false;
    }
  });
  on("emoji-picker", "cancel", (event) => {
    event.preventDefault();
    close();
  });
  on("picker-clear-emoji", "click", () => choose(""));
  on("use-custom-emoji", "click", useCustom);
  on("emoji-custom", "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      useCustom();
    }
  });
  on("emoji-custom", "input", () => {
    byId("emoji-picker-error").textContent = "";
  });
  for (const id of ["emoji-search", "emoji-category"])
    on(id, id === "emoji-search" ? "input" : "change", () => {
      limit = 144;
      render();
    });
  on("more-emoji", "click", () => {
    limit += 144;
    render();
  });
  on("emoji-results", "keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    const grid = byId("emoji-results");
    const items = [...grid.children],
      index = items.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const boxes = items.map((item) => item.getBoundingClientRect());
    const current = boxes[index];
    let target = index;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      target += event.key === "ArrowLeft" ? -1 : 1;
    else {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const rows = boxes
        .map((box, i) => ({ box, i }))
        .filter(({ box }) => direction * (box.top - current.top) > 1);
      if (rows.length) {
        const nearestTop = rows.reduce(
          (top, { box }) =>
            Math.abs(box.top - current.top) < Math.abs(top - current.top) ? box.top : top,
          rows[0].box.top
        );
        const candidates = rows.filter(({ box }) => Math.abs(box.top - nearestTop) <= 1);
        target = candidates.reduce((best, next) =>
          Math.abs(next.box.left - current.left) < Math.abs(best.box.left - current.left)
            ? next
            : best
        ).i;
      }
    }
    items[Math.max(0, Math.min(items.length - 1, target))]?.focus();
  });
  return { open };
}
