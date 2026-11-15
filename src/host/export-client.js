import { t } from "../i18n/index.js";
import {
  EXPORT_REQUEST,
  EXPORT_RESPONSE,
  MESSAGE_REQUEST,
  MESSAGE_ERROR,
  transportOrigin,
  targetOrigin
} from "./protocol.js";

export function createExportClient(window, timeoutMs = 30000) {
  const origin = window.origin ?? window.location.origin;
  const pending = new Map(),
    subscribers = new Set();
  let disposed = false,
    timer = null,
    revision,
    checking = false;
  function changed() {
    if (!disposed) for (const callback of subscribers) callback();
  }
  function receive(event) {
    if (event.source !== window.parent || transportOrigin(event.origin) !== transportOrigin(origin))
      return;
    const data = event.data;
    if (![EXPORT_RESPONSE, MESSAGE_ERROR].includes(data?.type)) return;
    const request = pending.get(data.messageId);
    if (!request) return;
    request.finish();
    if (data.type === MESSAGE_ERROR)
      request.reject(new Error(t(data.error || "Unable to export data.")));
    else if (data.result?.ok) request.resolve(data.result);
    else request.reject(new Error(t(data.result?.error || "Unable to export data.")));
  }
  window.addEventListener("message", receive);
  function request(recovery = false, asset, payload = {}) {
    if (disposed) return Promise.reject(new Error(t("The plugin view is closed.")));
    return new Promise((resolve, reject) => {
      const messageId = window.crypto.randomUUID();
      const finish = () => {
        window.clearTimeout(timeout);
        pending.delete(messageId);
      };
      const timeout = window.setTimeout(() => {
        finish();
        reject(new Error(t("The app did not respond to the request.")));
      }, timeoutMs);
      pending.set(messageId, { resolve, reject, finish });
      try {
        window.parent.postMessage(
          {
            type: MESSAGE_REQUEST,
            messageId,
            message: { ...payload, type: EXPORT_REQUEST, recovery, ...(asset ? { asset } : {}) }
          },
          targetOrigin(origin)
        );
      } catch (error) {
        finish();
        reject(error);
      }
    });
  }
  async function checkRevision() {
    if (disposed || checking || !subscribers.size) return;
    checking = true;
    try {
      const result = await request(false, "status");
      if (revision !== result.revision) {
        revision = result.revision;
        changed();
      }
    } catch {
      // Actual reads/writes report failures through the existing persistence UI.
    } finally {
      checking = false;
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    subscribers.clear();
    if (timer !== null) window.clearInterval(timer);
    window.removeEventListener("message", receive);
    for (const request of pending.values()) {
      request.finish();
      request.reject(new Error(t("The plugin view is closed.")));
    }
  }
  return {
    request,
    subscribe: (callback) => {
      if (disposed) return () => {};
      subscribers.add(callback);
      if (timer === null) {
        // The public API has no per-view hook unregister or host-to-view push.
        // Poll an in-memory revision instead of retaining detached iframe hooks.
        timer = window.setInterval?.(checkRevision, 5000) ?? null;
        void checkRevision();
      }
      return () => {
        subscribers.delete(callback);
        if (!subscribers.size && timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
      };
    },
    dispose
  };
}
