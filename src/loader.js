import { createExportClient } from "./host/export-client.js";
import { MAX_APPLICATION_CHARACTERS } from "./host/protocol.js";

const loaderKey = Symbol.for("habits.applicationLoader");

export function loadApplication(window, timeoutMs = 30000) {
  if (window[loaderKey]) return window[loaderKey];
  const client = createExportClient(window, timeoutMs);
  let disposed = false,
    installed = false;
  const cleanup = () => {
    window.removeEventListener("pagehide", dispose);
    client.dispose();
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    cleanup();
  }
  const controller = {
    dispose,
    installed: () => {
      installed = true;
    }
  };
  window[loaderKey] = controller;
  window.addEventListener("pagehide", dispose);
  window.PluginAPI?.onUnload?.(dispose);
  controller.ready = (async () => {
    try {
      const response = await client.request(false, "application");
      if (disposed) return false;
      if (
        typeof response.source !== "string" ||
        !response.source.trim() ||
        response.source.length > MAX_APPLICATION_CHARACTERS
      )
        throw new Error("Invalid bundled application");
      const script = window.document.createElement("script");
      script.textContent =
        response.source + '\n;window[Symbol.for("habits.applicationLoader")].installed();';
      window.document.head.append(script);
      if (!installed) throw new Error("The bundled application did not start");
      return true;
    } catch {
      if (!disposed) {
        const message = window.document.createElement("p");
        message.textContent =
          "Unable to load Habits. Reopen Habits to retry, or reinstall the plugin if the problem continues.";
        window.document.body.replaceChildren(message);
        window.document.body.hidden = false;
      }
      return false;
    } finally {
      cleanup();
    }
  })();
  return controller;
}

if (typeof window !== "undefined") loadApplication(window);
