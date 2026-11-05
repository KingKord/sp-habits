import { createExportClient } from "../host/export-client.js";
import { setLanguage, localizeDocument } from "./index.js";

export async function readAppLanguage(api) {
  try {
    // The host API returns a string; its iframe proxy returns a Promise.
    const code = await api?.getCurrentLanguage?.();
    if (typeof code === "string" && code) return code;
  } catch {
    // cfg.lang is supplied by older hosts and is preferable to the OS/browser language.
  }
  return api?.cfg?.lang?.code || "en";
}

export async function prepareLocalization(window) {
  const client = createExportClient(window);
  const dispose = () => client.dispose();
  window.addEventListener("pagehide", dispose);
  try {
    const [code, result] = await Promise.all([
      readAppLanguage(window.PluginAPI),
      client.request(false, "translations")
    ]);
    if (typeof result.styles !== "string" || !result.styles.trim())
      throw new Error("Missing plugin styles");
    const style = window.document.createElement("style");
    style.textContent = result.styles;
    window.document.head.append(style);
    setLanguage(code, result.messages);
    localizeDocument(window.document);
  } finally {
    window.removeEventListener("pagehide", dispose);
    client.dispose();
  }
}
