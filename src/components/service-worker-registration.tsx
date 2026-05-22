"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;
    let removeVisibilityListener: (() => void) | undefined;

    const onControllerChange = () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        const checkForUpdates = () => {
          void registration.update();
        };

        checkForUpdates();

        const onVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            checkForUpdates();
          }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        removeVisibilityListener = () => {
          document.removeEventListener("visibilitychange", onVisibilityChange);
        };
      });

    return () => {
      removeVisibilityListener?.();
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
