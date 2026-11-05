import { t } from "../i18n/index.js";
import {
  EXPORT_REQUEST,
  EXPORT_RESPONSE,
  SYSTEM_EMOJI_REQUEST,
  SYSTEM_EMOJI_RESPONSE,
  transportOrigin,
  targetOrigin
} from "./protocol.js";

export function createExportClient(window, timeoutMs = 30000) {
  // srcdoc inherits the host origin, although location.origin is "null".
  const origin = window.origin ?? window.location.origin;
  const pending = new Map();
  let disposed = false;
  const subscribers = new Set();

  function receive(event) {
    if (event.source !== window.parent || transportOrigin(event.origin) !== transportOrigin(origin))
      return;
    if (event.data?.type === "HABITS_DATA_CHANGED") {
      for (const callback of subscribers) callback();
      return;
    }
    const request = pending.get(event.data?.requestId);
    if (!request || request.responseType !== event.data.type) return;
    request.finish();
    if (event.data.ok) request.resolve(event.data);
    else request.reject(new Error(t(event.data.error || "Unable to export data.")));
  }
  window.addEventListener("message", receive);

  function send(type, responseType, payload) {
    if (disposed) return Promise.reject(new Error(t("The plugin view is closed.")));
    return new Promise((resolve, reject) => {
      const requestId = window.crypto.randomUUID();
      const finish = () => {
        window.clearTimeout(timer);
        pending.delete(requestId);
      };
      const timer = window.setTimeout(() => {
        finish();
        reject(new Error(t("The app did not respond to the request.")));
      }, timeoutMs);
      pending.set(requestId, { resolve, reject, finish, responseType });
      try {
        window.parent.postMessage({ type, requestId, ...payload }, targetOrigin(origin));
      } catch (error) {
        finish();
        reject(error);
      }
    });
  }

  function dispose() {
    disposed = true;
    subscribers.clear();
    window.removeEventListener("message", receive);
    for (const request of pending.values()) {
      request.finish();
      request.reject(new Error(t("The plugin view is closed.")));
    }
  }

  return {
    request: (recovery = false, asset, payload = {}) =>
      send(EXPORT_REQUEST, EXPORT_RESPONSE, { ...payload, recovery, ...(asset ? { asset } : {}) }),
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    systemEmoji: (open = false) => send(SYSTEM_EMOJI_REQUEST, SYSTEM_EMOJI_RESPONSE, { open }),
    dispose
  };
}
