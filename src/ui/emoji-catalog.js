import { t, localized } from "../i18n/index.js";

let pending;
export function loadEmojiCatalog(loadData) {
  pending ??= (async () => {
    const emojiData = await loadData();
    const bytes = Uint8Array.from(atob(emojiData), (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const groups = await new Response(stream).json();
    return groups.map(([id, entries]) => ({
      id,
      get name() {
        return t(id);
      },
      entries
    }));
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
export function emojiName(entry) {
  return localized({ en: entry[1], ru: entry[3] });
}
export function searchEmoji(groups, query = "", category = "") {
  const normalize = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return groups
    .filter((group) => !category || group.id === category)
    .flatMap((group) =>
      group.entries.filter(([emoji, name, keywords = "", translated = ""]) =>
        words.every((word) =>
          normalize(emoji + " " + name + " " + keywords + " " + translated).includes(word)
        )
      )
    );
}
