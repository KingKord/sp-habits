export const EXPORT_REQUEST = "HABITS_EXPORT_REQUEST";
export const EXPORT_RESPONSE = "HABITS_EXPORT_RESPONSE";
export const SYSTEM_EMOJI_REQUEST = "HABITS_SYSTEM_EMOJI_REQUEST";
export const SYSTEM_EMOJI_RESPONSE = "HABITS_SYSTEM_EMOJI_RESPONSE";

// Chromium can serialize file-based Electron origins as either "file://" or "null".
export function transportOrigin(origin) {
  return typeof origin === "string" && origin.startsWith("file:") ? "null" : origin;
}

export function targetOrigin(origin) {
  return transportOrigin(origin) === "null" ? "*" : origin;
}

export const MAX_APPLICATION_CHARACTERS = 4 * 1024 * 1024;
