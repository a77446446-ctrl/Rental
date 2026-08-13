/**
 * Единый скрытый вход в административную панель.
 * Шесть быстрых нажатий по логотипу открывают страницу авторизации.
 */
(function () {
  'use strict';

  var logo = document.getElementById('main-logo-link');
  if (!logo) return;

  var clicks = 0;
  var resetTimer = null;

  logo.addEventListener('click', function (event) {
    event.preventDefault();
    clicks += 1;

    if (clicks >= 6) {
      clearTimeout(resetTimer);
      window.location.assign('/admin/login');
      return;
    }

    clearTimeout(resetTimer);
    resetTimer = setTimeout(function () {
      clicks = 0;
    }, 1000);
  });
})();