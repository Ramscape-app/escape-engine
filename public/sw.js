// Service worker minimal — connexion requise (v1).
// Sa présence + un handler fetch suffisent à rendre la PWA installable.
// Volontairement sans cache : rien n'est précaché, donc aucun repli hors ligne
// n'est possible. Un `caches.match()` ici ne renverrait jamais que `undefined`,
// ce que respondWith() transforme en erreur réseau.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());
self.addEventListener('fetch', (e) => { /* passe-plat : le réseau gère tout */ });
