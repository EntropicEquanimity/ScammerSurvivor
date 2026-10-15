// Here only so that browsers which still ask for a service worker offer "install".
// It caches nothing on purpose: practice content always comes from the server.
self.addEventListener('fetch', () => {});
