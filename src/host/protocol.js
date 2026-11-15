export const EXPORT_REQUEST = "HABITS_EXPORT_REQUEST";
export const EXPORT_RESPONSE = "PLUGIN_MESSAGE_RESPONSE";
export const MESSAGE_REQUEST = "PLUGIN_MESSAGE";
export const MESSAGE_ERROR = "PLUGIN_MESSAGE_ERROR";

// Chromium can serialize file-based Electron origins as either "file://" or "null".
export function transportOrigin(origin) {
  return typeof origin === "string" && origin.startsWith("file:") ? "null" : origin;
}

export function targetOrigin(origin) {
  return transportOrigin(origin) === "null" ? "*" : origin;
}

export const MAX_APPLICATION_CHARACTERS = 4 * 1024 * 1024;
