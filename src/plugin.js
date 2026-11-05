import styles from "./styles.css";
import { installExportBridge } from "./host/export-host.js";
import { createTaskIntegration } from "./task-integration.js";
import { targetOrigin } from "./host/protocol.js";

let tasks = null,
  timer = null,
  started = false,
  disposed = false;
if (PluginAPI.registerHook && PluginAPI.getAppState) {
  const notify = () => {
    for (const frame of document.querySelectorAll("iframe")) {
      try {
        if (frame.contentDocument?.title === "Habits")
          frame.contentWindow.postMessage(
            { type: "HABITS_DATA_CHANGED" },
            targetOrigin(window.location.origin)
          );
      } catch {
        /* Other plugin frames are not recipients. */
      }
    }
  };
  tasks = createTaskIntegration(PluginAPI, notify);
  for (const hook of ["taskComplete", "taskUpdate", "anyTaskUpdate", "persistedDataChanged"])
    PluginAPI.registerHook(hook, tasks.refresh);
  PluginAPI.onReady?.(() => {
    if (started || disposed) return;
    started = true;
    void tasks.refresh();
    timer = window.setInterval(tasks.refresh, 30000);
  });
}
const dispose = installExportBridge(PluginAPI, window, document, tasks, styles);
PluginAPI.onUnload?.(() => {
  disposed = true;
  dispose();
  tasks?.dispose();
  if (timer !== null) window.clearInterval(timer);
});
