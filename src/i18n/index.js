// English is the source and fallback language. User data never passes through t().
let language = "en";
let translations = {};

export function normalizeLanguage(code) {
  return typeof code === "string" && /^ru(?:[-_]|$)/i.test(code) ? "ru" : "en";
}

export function setLanguage(code, messages) {
  language = normalizeLanguage(code);
  if (messages) translations = messages;
}

export const getLanguage = () => language;
export const getLocale = () => (language === "ru" ? "ru-RU" : "en-GB");

export const localized = (values) => values[language] ?? values.en;

export function t(source) {
  if (language === "en") return source;
  const translated = translations[source];
  return typeof translated === "string" ? translated : source;
}

export function plural(one, other, count) {
  const translated = language === "en" ? null : translations[other];
  if (translated && typeof translated === "object") {
    const category = new Intl.PluralRules(getLocale()).select(count);
    return translated[category] ?? translated.other ?? other;
  }
  return count === 1 ? t(one) : t(other);
}

// Run once on authored English markup before rendering any user-entered data.
export function localizeDocument(document) {
  document.documentElement.lang = language;
  const walker = document.createTreeWalker(document.body, 4);
  let node;
  while ((node = walker.nextNode())) {
    if (["SCRIPT", "STYLE"].includes(node.parentElement?.tagName)) continue;
    const original = node.textContent;
    const key = original.replace(/\s+/g, " ").trim();
    if (key && t(key) !== key) node.textContent = t(key);
  }
  for (const element of document.querySelectorAll("[aria-label], [placeholder], [title]"))
    for (const attribute of ["aria-label", "placeholder", "title"])
      if (element.hasAttribute(attribute))
        element.setAttribute(attribute, t(element.getAttribute(attribute)));
}
