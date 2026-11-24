import { Capacitor } from "@capacitor/core";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { PwaUpdateNotice } from "./components/PwaUpdateNotice";
import { registerRoperoServiceWorker } from "./pwa";

const nativeApp = Capacitor.isNativePlatform();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    {!nativeApp && <PwaInstallPrompt />}
    {!nativeApp && <PwaUpdateNotice />}
  </React.StrictMode>,
);

let updateServiceWorker: Awaited<ReturnType<typeof registerRoperoServiceWorker>> = null;
let updateReadyPending = false;

const updateReadyEvent = "ropero:update-ready";
const updateReadyRequestEvent = "ropero:update-ready-request";

function announceUpdate() {
  updateReadyPending = true;
  if (!updateServiceWorker) {
    return;
  }

  window.dispatchEvent(new CustomEvent(updateReadyEvent, { detail: updateServiceWorker }));
}

// The component subscribes in an effect, which can happen after registration
// has already resolved. Let it request the current value so the event cannot
// be lost in that gap.
window.addEventListener(updateReadyRequestEvent, () => {
  if (!updateReadyPending || !updateServiceWorker) return;
  window.dispatchEvent(new CustomEvent(updateReadyEvent, { detail: updateServiceWorker }));
});

if (!nativeApp) void registerRoperoServiceWorker({
  onOfflineReady: () => window.dispatchEvent(new CustomEvent("ropero:offline-ready")),
  onNeedRefresh: announceUpdate,
}).then((update) => {
  updateServiceWorker = update;
  if (updateReadyPending) announceUpdate();
});
