// Service worker de Obras Rugby Hub — recibe los push reales y los muestra
// como notificación del sistema, aunque la app esté cerrada.

self.addEventListener("push", (event) => {
  let data = { title: "Obras Rugby Hub", body: "Tenés una notificación nueva." };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Obras Rugby Hub", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "general",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return self.clients.openWindow("/");
    })
  );
});
