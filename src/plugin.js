import styles from "./styles.css";
import applicationSource from "habits:application";
import { installExportBridge } from "./host/export-host.js";
import { createTaskIntegration } from "./task-integration.js";

let tasks = null,
  timer = null,
  started = false,
  disposed = false,
  revision = 0;
if (PluginAPI.registerHook && PluginAPI.getAppState) {
  const notify = () => {
    if (!disposed) revision++;
  };
  tasks = createTaskIntegration(PluginAPI, notify);
  for (const hook of ["taskComplete", "taskUpdate", "anyTaskUpdate"])
    PluginAPI.registerHook(hook, tasks.refresh);
  PluginAPI.registerHook("persistedDataChanged", () => {
    notify();
    return tasks.refresh();
  });
  PluginAPI.onReady?.(() => {
    if (started || disposed) return;
    started = true;
    void tasks.refresh();
    timer = window.setInterval(tasks.refresh, 30000);
  });
}
const dispose = installExportBridge(PluginAPI, tasks, styles, applicationSource, () => revision);
PluginAPI.onUnload?.(() => {
  disposed = true;
  dispose();
  tasks?.dispose();
  if (timer !== null) window.clearInterval(timer);
});
