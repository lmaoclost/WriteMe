import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";
import { i18n } from "../i18n";
import { useScriptorium } from "../data/store";

let updateToastShown = false;

/** Prompted service-worker updates: one toast with "Reload"; no auto-reload
 *  mid-edit (the data layer lives in the browser, so a stale shell is safe). */
export function PwaUpdate() {
  useEffect(() => {
    updateToastShown = false;
    const update = registerSW({
      onNeedRefresh: () => {
        if (updateToastShown) return;
        updateToastShown = true;
        useScriptorium.getState().pushToast("info", i18n.t("pwa.updateReady"), {
          label: i18n.t("pwa.reload"),
          run: () => { location.reload(); },
        });
      },
    });
    return () => {
      if (typeof update !== "function") return; // the virtual module may not resolve in tests
      void update().catch(() => {}); // reloadPage default; dispose the promise
    };
  }, []);
  return null;
}
