"use client";

// Web Push requires the VAPID public key as a raw byte array, not the
// base64url string it's normally shared as — this is the standard
// conversion, copied nowhere near creatively, every Web Push tutorial has
// this exact function because the browser API just requires it verbatim.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Returns "unsupported" | "granted" | "denied" | "default" — lets the UI
// show the right message instead of a button that silently does nothing.
export function getNotificationSupportState() {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission; // "default" | "granted" | "denied"
}

// The whole opt-in flow: ask permission, subscribe via the browser's push
// service, hand the subscription to our server to store. Throws a plain
// Error with a message safe to show the user directly on any failure.
export async function subscribeToPush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications refusées — tu peux les activer plus tard dans les réglages du navigateur.");
  }

  const registration = await navigator.serviceWorker.ready;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Configuration manquante côté serveur (clé VAPID).");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) throw new Error("Échec de l'enregistrement des notifications.");

  return subscription;
}
