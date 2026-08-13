/**
 * Инициализация технической страницы: тема и фирменный логотип из CMS.
 */
(function () {
  'use strict';

  function initials(value) {
    return String(value || 'ECO Gorniy')
      .split(/[\s-]+/)
      .filter(Boolean)
      .map(function (part) { return part.charAt(0); })
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'EG';
  }

  function showLogo(logo) {
    var mark = document.getElementById('main-logo-img');
    var name = document.getElementById('main-logo-text');
    if (!mark || !name) return;

    var label = String(logo && logo.text || 'ECO Gorniy');
    name.textContent = label;

    if (!logo || !logo.url) {
      mark.textContent = initials(label);
      mark.classList.add('logo-fallback');
      return;
    }

    var image = document.createElement('img');
    image.src = window.EcoMedia ? window.EcoMedia.url(logo.url) : logo.url;
    image.alt = 'Логотип ' + label;
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.addEventListener('error', function () {
      mark.replaceChildren();
      mark.textContent = initials(label);
      mark.classList.remove('has-image');
      mark.classList.add('logo-fallback');
    });

    mark.replaceChildren(image);
    mark.classList.remove('logo-fallback');
    mark.classList.add('has-image');
  }

  fetch('/api/mainpage', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) throw new Error('Не удалось загрузить настройки бренда');
      return response.json();
    })
    .then(function (payload) {
      showLogo(payload && payload.success && payload.data ? payload.data.logo : null);
    })
    .catch(function () {
      showLogo(null);
    });
})();