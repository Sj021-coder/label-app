// Minimal service worker — its only job is to receive a push message from
// the server and show a real system notification, then handle a tap on it.
// Everything else (subscribing, permission prompts) happens in normal page
// JS; this file just needs to exist and be registered.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LABEL", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "LABEL";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an already-open tab if one exists,
// otherwise opens a new one at the relevant page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
