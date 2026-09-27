// Service worker mínimo: permite mostrar el aviso de citas como notificación del celular
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ventanas =>
        ventanas.length ? ventanas[0].focus() : self.clients.openWindow('./')));
});
