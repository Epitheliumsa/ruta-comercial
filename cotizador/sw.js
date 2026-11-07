// Cotizador Epithelium: guarda la app para abrirla sin conexión (el motor se guarda aparte, en el equipo)
const CACHE = 'cotizador-202611071200';
const ARCHIVOS = ['./', './index.html', './cotizador.js?v=202611071200', './usuarios.js?v=202611071200', './manifest.json', './lib/jspdf.umd.min.js',
  '../styles.css?v=202611071200', '../logo.png', '../logo-blanco.png', '../icons/favicon-32.png', '../icons/apple-touch-icon.png', '../icons/icon-192.png', '../icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('cotizador-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Primero la red (siempre lo último publicado); sin conexión, lo guardado
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
