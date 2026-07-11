(function() {
  'use strict';

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  if (window.__mainpageMetaFetchPatched) return;
  window.__mainpageMetaFetchPatched = true;

  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = init && init.method ? String(init.method).toUpperCase() : 'GET';

    if (url === '/api/admin/mainpage' && method === 'POST' && init && init.body) {
      try {
        var body = JSON.parse(init.body);
        body.features_meta = {
          label: fieldValue('featuresLabel'),
          title: fieldValue('featuresTitle')
        };
        body.reviews_meta = {
          label: fieldValue('reviewsLabel'),
          title: fieldValue('reviewsTitle')
        };
        body.contacts = body.contacts || {};
        body.contacts.label = fieldValue('contactLabel');
        body.contacts.title = fieldValue('contactTitle');
        body.contacts.desc = fieldValue('contactDesc');
        init = Object.assign({}, init, { body: JSON.stringify(body) });
      } catch (err) {
        console.error('[admin-mainpage-meta] save patch failed:', err);
      }
    }

    return originalFetch.call(this, input, init);
  };
})();
