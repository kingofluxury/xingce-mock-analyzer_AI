import { getStore } from "./store.js";

(async () => {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return;
    if (!("serviceWorker" in navigator)) return;
    const store = await getStore();
    if (store.kind !== "local") return;
    await navigator.serviceWorker.register("./service-worker.js");
  } catch {
    void 0;
  }
})();
