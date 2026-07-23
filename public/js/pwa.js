(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;

  var deferredInstallPrompt = null;
  var installPromptReady = false;
  var installCard = null;
  var DISMISS_KEY = 'eco-pwa-install-dismissed-until';
  var INSTALLED_KEY = 'eco-pwa-installed';
  var DISMISS_DAYS = 7;
  var PROMPT_DELAY = 18000;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function isPublicHome() {
    return window.location.pathname === '/' || window.location.pathname === '/index.html';
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {}
  }

  function shouldOfferInstall() {
    if (!isPublicHome() || isStandalone()) return false;
    if (readStorage(INSTALLED_KEY) === '1') return false;
    var dismissedUntil = Number(readStorage(DISMISS_KEY) || 0);
    return !dismissedUntil || Date.now() >= dismissedUntil;
  }

  function closeInstallCard(rememberDismissal) {
    if (!installCard) return;
    installCard.classList.remove('is-visible');
    var cardToRemove = installCard;
    installCard = null;
    window.setTimeout(function () {
      cardToRemove.remove();
    }, 320);

    if (rememberDismissal) {
      writeStorage(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
      );
    }
  }

  function showIosInstructions(card) {
    var description = card.querySelector('.pwa-install-description');
    var hint = card.querySelector('.pwa-install-ios-hint');
    var primary = card.querySelector('.pwa-install-primary');
    if (description) {
      description.textContent = 'В Safari нажмите «Поделиться», затем выберите «На экран Домой».';
    }
    if (hint) hint.hidden = false;
    if (primary) {
      primary.textContent = 'Понятно';
      primary.setAttribute('data-ios-ready', 'true');
    }
  }

  function createInstallCard() {
    var card = document.createElement('aside');
    card.className = 'pwa-install-prompt';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'pwa-install-title');
    card.innerHTML =
      '<button type="button" class="pwa-install-close" aria-label="Закрыть">×</button>' +
      '<div class="pwa-install-icon" aria-hidden="true">' +
        '<img src="/api/pwa-icon/192.png" alt="">' +
      '</div>' +
      '<div class="pwa-install-copy">' +
        '<span class="pwa-install-kicker">ECO-Gorniy всегда под рукой</span>' +
        '<strong id="pwa-install-title">Установите приложение</strong>' +
        '<p class="pwa-install-description">Открывайте бронирование с рабочего стола — без вкладок и интерфейса браузера.</p>' +
        '<p class="pwa-install-ios-hint" hidden><b>1.</b> Нажмите значок «Поделиться» <span aria-hidden="true">□↑</span><br><b>2.</b> Выберите «На экран Домой».</p>' +
        '<div class="pwa-install-actions">' +
          '<button type="button" class="pwa-install-primary">' +
            (isIos() ? 'Как установить' : 'Установить') +
          '</button>' +
          '<button type="button" class="pwa-install-later">Не сейчас</button>' +
        '</div>' +
      '</div>';

    card.querySelector('.pwa-install-close').addEventListener('click', function () {
      closeInstallCard(true);
    });
    card.querySelector('.pwa-install-later').addEventListener('click', function () {
      closeInstallCard(true);
    });
    card.querySelector('.pwa-install-primary').addEventListener('click', async function (event) {
      if (isIos()) {
        if (event.currentTarget.getAttribute('data-ios-ready') === 'true') {
          closeInstallCard(true);
        } else {
          showIosInstructions(card);
        }
        return;
      }

      if (!deferredInstallPrompt) return;
      var promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      promptEvent.prompt();
      try {
        var choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          writeStorage(INSTALLED_KEY, '1');
          closeInstallCard(false);
        } else {
          closeInstallCard(true);
        }
      } catch (err) {
        closeInstallCard(true);
      }
    });

    return card;
  }

  function maybeShowInstallCard() {
    if (!installPromptReady || installCard || !shouldOfferInstall()) return;
    if (!isIos() && !deferredInstallPrompt) return;

    installCard = createInstallCard();
    document.body.appendChild(installCard);
    window.requestAnimationFrame(function () {
      if (installCard) installCard.classList.add('is-visible');
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    maybeShowInstallCard();
  });

  window.addEventListener('appinstalled', function () {
    writeStorage(INSTALLED_KEY, '1');
    closeInstallCard(false);
    deferredInstallPrompt = null;
  });

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && installCard) closeInstallCard(true);
  });

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

    window.setTimeout(function () {
      installPromptReady = true;
      maybeShowInstallCard();
    }, PROMPT_DELAY);
  });
})();
