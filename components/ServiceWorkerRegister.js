"use client";

import { useEffect } from "react";

// Registers /sw.js once, silently, on every page load. This alone doesn't
// ask for notification permission or subscribe anyone to anything — it
// just makes the service worker available so that when a user later opts
// in (NotificationPrompt.js), the browser has somewhere to deliver a push
// message to.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — the app works fine without it, just no push notifications.
    });
  }, []);

  return null;
}
