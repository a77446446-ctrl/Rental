(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;

  window.addEventListener('load', function () {
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(function (registration) {
        return registration.update();
      })
      .catch(function (err) {
        console.warn('[PWA] Service worker registration failed:', err);
      });
  });
})();
