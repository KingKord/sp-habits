import { createApplication } from "./application.js";
import { prepareLocalization } from "./i18n/setup.js";

export function bootApplication(window, create = createApplication, prepare = prepareLocalization) {
  let application = null;
  let disposed = false;
  let starting = false;
  const api = window.PluginAPI;

  async function start() {
    if (disposed || starting || application) return;
    starting = true;
    try {
      await prepare(window);
    } catch {
      if (!disposed) {
        const document = window.document;
        const message = document.createElement("p");
        message.textContent = "Unable to load the plugin assets. Reopen Habits to retry.";
        document.body.replaceChildren(message);
        document.body.hidden = false;
      }
      return;
    }
    if (disposed) return;
    window.document.body.hidden = false;
    application = create({ window, api });
    void application.start();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("pagehide", dispose);
    application?.dispose();
  }

  window.addEventListener("pagehide", dispose);
  api?.onUnload?.(dispose);
  if (api?.onReady) api.onReady(start);
  else start();

  return { dispose };
}
