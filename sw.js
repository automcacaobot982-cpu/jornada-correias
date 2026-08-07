/* Service Worker — Jornada das Correias
   Estratégia:
   - HTML/navegação: network-first (sempre pega a versão nova quando online; cache é só p/ offline).
   - Ícones/manifest/assets locais: cache-first.
   - Fontes do Google: cache-first (para manter o visual offline).
   - Dados das planilhas (docs.google.com): SEMPRE pela rede, nunca cacheado (mantém atualizado).
   Se você editar o portal, é só subir o index.html novo — ele será baixado sozinho ao abrir online.
   Só é preciso mudar o número de versão abaixo se alterar ESTE arquivo (sw.js). */
const CACHE = 'jornada-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Dados do Google: sempre rede, nunca cache
  if (url.hostname.indexOf('docs.google.com') > -1) {
    e.respondWith(fetch(req).catch(() => new Response('', { status: 504 })));
    return;
  }

  // Fontes do Google: cache-first
  if (url.hostname.indexOf('fonts.googleapis.com') > -1 || url.hostname.indexOf('fonts.gstatic.com') > -1) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((r) => { c.put(req, r.clone()); return r; }).catch(() => hit))
      )
    );
    return;
  }

  // Mesma origem
  if (url.origin === self.location.origin) {
    // HTML / navegação: network-first
    if (req.mode === 'navigate' || req.destination === 'document') {
      e.respondWith(
        fetch(req)
          .then((r) => { caches.open(CACHE).then((c) => c.put('./index.html', r.clone())); return r; })
          .catch(() => caches.match('./index.html').then((h) => h || caches.match('./')))
      );
      return;
    }
    // Demais assets locais: cache-first
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => {
        caches.open(CACHE).then((c) => c.put(req, r.clone())); return r;
      }))
    );
    return;
  }

  // Outros: rede com fallback ao cache
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});
