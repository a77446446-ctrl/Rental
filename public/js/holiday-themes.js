/**
 * Модуль праздничных и сезонных подтем (EcoHolidayThemes)
 * Размещает готовые SVG-иллюстрации из /seasonal-decor/<theme>/ поверх выбранной цветовой темы:
 * Декор закреплён на верхних границах; содержимое и управление остаются свободными.
 */
(function () {
  'use strict';

  var SUBTHEMES = ['none', 'new-year', 'feb23', 'mar8', 'spring', 'may1', 'sep1', 'nov4'];
  var ASSET_BASE = '/seasonal-decor/';
  var ASSET_VERSION = '?v=20261115-13';

  var META = {
    'none': {
      label: 'Выключено',
      description: 'Стандартный вид сайта без сезонного декора'
    },
    'new-year': {
      label: 'Новый год и Рождество',
      description: 'Снеговик машет у чата, еловые ветви с игрушками, снежные шапки и неподвижные сосульки'
    },
    'feb23': {
      label: '23 Февраля',
      description: 'День защитника Отечества: лавровый орнамент, латунные звёзды и оливково-золотая лента'
    },
    'mar8': {
      label: '8 Марта',
      description: 'Веточки мимозы, розовые тюльпаны, цветочные гирлянды и лепестки'
    },
    'spring': {
      label: 'Весна',
      description: 'Берёзовые ветви с серёжками, подснежники, листья с росой и цветы яблони'
    },
    'may1': {
      label: '1 Мая (Первомай)',
      description: 'Тканевые флажки, цветущая яблоня, праздничные ленты и бумажные спирали'
    },
    'sep1': {
      label: '1 Сентября / Золотая осень',
      description: 'Кленовые листья, гроздья рябины, школьный колокольчик с бантом'
    },
    'nov4': {
      label: 'Ноябрьские праздники (4 ноября)',
      description: 'День народного единства: дубовые ветви с желудями, рябина и лента триколора'
    }
  };

  var THEME_ASSETS = {
    'new-year': {
      folder: 'new-year',
      header: 'header.svg',
      branches: 'garland-continuous.webp',
      heroSnow: 'snow-layer-7.webp',
      territorySnow: 'snow-layer-8.webp',
      cardSnow: [
        'snow-layer-1.webp', 'snow-layer-2.webp', 'snow-layer-3.webp',
        'snow-layer-4.webp', 'snow-layer-5.webp', 'snow-layer-6.webp'
      ],
      buttonSnow: 'snow-cap.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'snowman.webp',
      particles: ['particle.svg', 'particle-alt.svg', 'snowflake-detail.svg'],
      cardCornerRight: 'house-fir-branch.webp',
      icicles: 'icicles-short.svg',
      buttonCharm: 'snowflake-detail.svg'
    },
    'feb23': {
      folder: 'february-23',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'laurel-star.svg',
      buttonCharm: 'logo-charm.svg'
    },
    'mar8': {
      folder: 'march-8',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'mimosa-sprig.svg',
      buttonCharm: 'tulip-stem.svg'
    },
    'spring': {
      folder: 'spring',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'birch-sprig.svg',
      buttonCharm: 'dewy-leaf.svg'
    },
    'may1': {
      folder: 'may-1',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'fabric-flags.svg',
      buttonCharm: 'ribbon-knot.svg'
    },
    'sep1': {
      folder: 'september-1',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'rowan-sprig.svg',
      buttonCharm: 'maple-leaf.svg'
    },
    'nov4': {
      folder: 'november-4',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'oak-sprig.svg',
      buttonCharm: 'tricolor-bow.svg'
    }
  };

  var DECOR_SELECTOR =
    '.holiday-particles-layer, .holiday-screen-corners, .holiday-header-decor, ' +
    '.holiday-banner-decor, .holiday-card-decor, .holiday-corner-mascot, ' +
    '.holiday-corner-mascot-inline, .holiday-logo-badge, .holiday-btn-decor, .holiday-text-decor';

  var currentState = {
    subtheme: 'none',
    particles: true
  };

  var observer = null;
  var syncScheduled = false;

  function normalizeSubtheme(value) {
    var v = String(value || 'none').trim();
    return SUBTHEMES.indexOf(v) !== -1 ? v : 'none';
  }

  function normalizeParticles(value) {
    return value !== false && value !== 'false';
  }

  function getAssets(subtheme) {
    return THEME_ASSETS[subtheme] || null;
  }

  function assetUrl(subtheme, file) {
    var assets = getAssets(subtheme);
    if (!assets || !file) return '';
    return ASSET_BASE + assets.folder + '/' + file + ASSET_VERSION;
  }

  function createDecorImg(src, className) {
    var img = document.createElement('img');
    if (className) img.className = className;
    img.src = src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.setAttribute('draggable', 'false');
    img.setAttribute('decoding', 'async');
    return img;
  }

  function createDecorBox(className, src, imgClass) {
    var box = document.createElement('div');
    box.className = className;
    box.setAttribute('aria-hidden', 'true');
    box.appendChild(createDecorImg(src, imgClass || ''));
    return box;
  }

  function clearBodySubthemeClasses(target) {
    if (!target || !target.classList) return;
    SUBTHEMES.forEach(function (name) {
      target.classList.remove('subtheme-' + name);
    });
    target.classList.remove('subtheme-particles-on');
  }

  function removeAllDecorations() {
    document.querySelectorAll(DECOR_SELECTOR).forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    document.querySelectorAll('[data-holiday-subtheme]').forEach(function (el) {
      el.removeAttribute('data-holiday-subtheme');
    });
  }

  /* ========================================================================
     1. Фоновые падающие частицы
     ======================================================================== */
  function renderParticles(subtheme) {
    var assets = getAssets(subtheme);
    if (!document.body || !assets || !currentState.particles) return;
    if (document.querySelector('.holiday-particles-layer')) return;

    var layer = document.createElement('div');
    layer.className = 'holiday-particles-layer';
    layer.setAttribute('aria-hidden', 'true');

    var list = assets.particles && assets.particles.length ? assets.particles : ['particle.svg'];
    var winter = subtheme === 'new-year';
    var count = winter ? 30 : 12;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'holiday-particle';

      var leftPct = ((i * 37 + 11) % 94) + 2;
      var sizePx = winter ? 8 + ((i * 5) % 12) : 9 + ((i * 5) % 7);
      var durSec = (winter ? 11 : 16) + ((i * 3) % 9);
      var delaySec = -((i * 1.7) % (winter ? 19 : 10));
      var driftPx = (i % 2 === 0 ? 1 : -1) * (24 + (i % 5) * 14);
      var opacityVal = (winter ? 0.62 : 0.24) + (i % 4) * 0.04;

      p.style.setProperty('--p-left', leftPct + '%');
      p.style.setProperty('--p-size', sizePx + 'px');
      p.style.setProperty('--p-dur', durSec.toFixed(1) + 's');
      p.style.setProperty('--p-delay', delaySec.toFixed(1) + 's');
      p.style.setProperty('--p-drift', driftPx + 'px');
      p.style.setProperty('--p-opacity', opacityVal.toFixed(2));

      var file = list[i % list.length];
      p.appendChild(createDecorImg(assetUrl(subtheme, file), 'holiday-particle-img'));
      layer.appendChild(p);
    }

    document.body.appendChild(layer);
  }

  /* ========================================================================
     2. Углы экрана и верхняя гирлянда экрана
     ======================================================================== */
  function renderScreenCorners(subtheme) {
    var assets = getAssets(subtheme);
    if (!document.body || !assets || subtheme === 'new-year') return;
    if (document.querySelector('.holiday-screen-corners')) return;

    var container = document.createElement('div');
    container.className = 'holiday-screen-corners';
    container.setAttribute('aria-hidden', 'true');

    container.appendChild(
      createDecorBox('holiday-corner-branch holiday-corner-branch--left', assetUrl(subtheme, assets.cornerLeft))
    );
    container.appendChild(
      createDecorBox('holiday-corner-branch holiday-corner-branch--right', assetUrl(subtheme, assets.cornerRight))
    );

    document.body.appendChild(container);
  }

  /* ========================================================================
     3. Один зимний персонаж, привязанный к кнопке чата или её предпросмотру
     ======================================================================== */
  function renderCornerMascot(subtheme) {
    var assets = getAssets(subtheme);
    if (!document.body || !assets || subtheme !== 'new-year') return;
    var anchor = document.getElementById('chat-widget') || document.getElementById('previewFab');
    if (!anchor || anchor.querySelector('.holiday-corner-mascot')) return;
    var src = assetUrl(subtheme, assets.accent);
    var mascot = createDecorBox('holiday-corner-mascot', src, 'holiday-mascot-img');
    // Обе части используют одну картинку. Маска выделяет только поднятую руку.
    mascot.appendChild(createDecorImg(src, 'holiday-mascot-arm'));
    anchor.appendChild(mascot);
  }

  function createWinterGarland(assets) {
    return createDecorBox('holiday-winter-garland', assetUrl('new-year', assets.branches));
  }

  function createIcicles(assets, className) {
    var row = document.createElement('span');
    row.className = className;
    row.setAttribute('aria-hidden', 'true');
    row.style.setProperty('--winter-ice', 'url("' + assetUrl('new-year', assets.icicles) + '")');
    return row;
  }

  /* ========================================================================
     4. Декор шапки сайта (.header, .cabin-header, .admin-header)
     ======================================================================== */
  function decorateHeaders(subtheme) {
    var assets = getAssets(subtheme);
    if (!assets) return;

    var headerSrc = assetUrl(subtheme, assets.header);

    document.querySelectorAll('.header, .cabin-header, .admin-header').forEach(function (header) {
      if (header.getAttribute('data-holiday-subtheme') === subtheme && header.querySelector('.holiday-header-decor')) return;
      var old = header.querySelector('.holiday-header-decor');
      if (old) old.remove();

      var decor = document.createElement('div');
      decor.className = 'holiday-header-decor';
      decor.setAttribute('aria-hidden', 'true');
      if (subtheme === 'new-year') {
        decor.appendChild(createWinterGarland(assets));
      } else {
        decor.appendChild(createDecorImg(headerSrc, 'holiday-header-garland'));
      }

      header.setAttribute('data-holiday-subtheme', subtheme);
      header.appendChild(decor);
    });
  }

  /* ========================================================================
     6. Главный баннер, предпросмотр админки и сцена территории
     ======================================================================== */
  function decorateBanner(container, subtheme) {
    var assets = getAssets(subtheme);
    if (!container || !assets) return;
    if (container.getAttribute('data-holiday-subtheme') === subtheme && container.querySelector('.holiday-banner-decor')) return;

    var old = container.querySelector('.holiday-banner-decor');
    if (old) old.remove();

    var decor = document.createElement('div');
    decor.className = 'holiday-banner-decor';
    decor.setAttribute('aria-hidden', 'true');

    if (subtheme === 'new-year') {
      var territory = container.classList.contains('territory-stage');
      var snow = territory ? assets.territorySnow : assets.heroSnow;
      decor.appendChild(createDecorBox('holiday-banner-edge', assetUrl(subtheme, snow)));
      decor.appendChild(createIcicles(assets, territory ? 'holiday-territory-icicles' : 'holiday-banner-icicles'));
    } else {
      decor.appendChild(createDecorBox('holiday-banner-garland', assetUrl(subtheme, assets.header)));
    }

    container.setAttribute('data-holiday-subtheme', subtheme);
    container.appendChild(decor);
  }

  /* ========================================================================
     7. Карточки и контентные блоки
     ======================================================================== */
  function decorateCard(card, subtheme, index) {
    var assets = getAssets(subtheme);
    if (!card || !assets) return;

    // После первого прохода отражаем силуэты, чтобы соседние карточки не повторялись.
    var profiles = assets.cardSnow;
    var slot = profiles ? index % (profiles.length * 2) : 0;
    var old = card.querySelector('.holiday-card-decor');
    if (old && card.getAttribute('data-holiday-subtheme') === subtheme &&
        (!profiles || old.getAttribute('data-snow-slot') === String(slot))) return;
    if (old) old.remove();

    var decor = document.createElement('div');
    decor.className = 'holiday-card-decor';
    decor.setAttribute('aria-hidden', 'true');

    var snow = profiles ? profiles[slot % profiles.length] : assets.blockEdge;
    var edge = createDecorBox('holiday-block-edge', assetUrl(subtheme, snow));
    if (profiles) {
      decor.setAttribute('data-snow-slot', String(slot));
      if (slot >= profiles.length) edge.classList.add('holiday-block-edge-mirrored');
    }
    decor.appendChild(edge);
    // Подвеска допустима только над фотографией дома, вдали от текста и формы.
    if (card.classList.contains('house-card') && assets.cardCornerRight) {
      decor.appendChild(createDecorBox('holiday-card-top-right', assetUrl(subtheme, assets.cardCornerRight)));
    }
    if (subtheme === 'new-year' && card.id === 'contact-bg-card') {
      decor.appendChild(createIcicles(assets, 'holiday-banner-icicles'));
    }

    card.setAttribute('data-holiday-subtheme', subtheme);
    card.appendChild(decor);
  }

  /* ========================================================================
     8. Декор кнопок
     ======================================================================== */
  function decorateButtons(subtheme) {
    var assets = getAssets(subtheme);
    if (!assets) return;

    var charmSrc = assetUrl(subtheme, assets.buttonCharm || assets.logoCharm);
    var edgeSrc = assetUrl(subtheme, assets.buttonSnow);

    var buttonSelector = '.btn-primary, .header-action';
    if (subtheme === 'new-year') buttonSelector += ', .btn-ghost';
    document.querySelectorAll(buttonSelector).forEach(function (btn) {
      if (btn.getAttribute('data-holiday-subtheme') === subtheme && btn.querySelector('.holiday-btn-decor')) return;
      var old = btn.querySelector('.holiday-btn-decor');
      if (old) old.remove();

      var decor = document.createElement('span');
      decor.className = 'holiday-btn-decor';
      decor.setAttribute('aria-hidden', 'true');

      if (subtheme === 'new-year') {
        var bookingButton = btn.classList.contains('header-action') || btn.id === 'submitBookingBtn';
        decor.appendChild(createDecorImg(edgeSrc, 'holiday-btn-edge'));
        if (bookingButton) decor.appendChild(createIcicles(assets, 'holiday-btn-icicles'));
      } else if (charmSrc) {
        decor.appendChild(createDecorImg(charmSrc, 'holiday-btn-charm'));
      }

      btn.setAttribute('data-holiday-subtheme', subtheme);
      btn.appendChild(decor);
    });
  }

  function syncDomDecorations() {
    var subtheme = currentState.subtheme;
    if (!document.body || subtheme === 'none' || !getAssets(subtheme)) return;

    renderParticles(subtheme);
    renderScreenCorners(subtheme);
    renderCornerMascot(subtheme);
    decorateHeaders(subtheme);

    document.querySelectorAll('.hero-stage, #previewArea, .territory-stage').forEach(function (el) {
      decorateBanner(el, subtheme);
    });

    document.querySelectorAll('.house-card, .hero-booking, .calendar-card, .checkout-card, .cta-card, .feature-panel, .review, .cabin-hero-card, .success-container').forEach(function (card, index) {
      decorateCard(card, subtheme, index);
    });

    decorateButtons(subtheme);
  }

  function scheduleSync() {
    if (syncScheduled || currentState.subtheme === 'none') return;
    syncScheduled = true;
    requestAnimationFrame(function () {
      syncScheduled = false;
      syncDomDecorations();
    });
  }

  function isOwnDecorNode(node) {
    if (!node || node.nodeType !== 1) return false;
    var cn = typeof node.className === 'string' ? node.className : '';
    return cn.indexOf('holiday-') !== -1;
  }

  function ensureObserver() {
    if (observer || typeof MutationObserver === 'undefined' || !document.body) return;
    observer = new MutationObserver(function (mutations) {
      if (currentState.subtheme === 'none') return;
      var hasForeignNodes = mutations.some(function (m) {
        if (!m.addedNodes || m.addedNodes.length === 0) return false;
        for (var i = 0; i < m.addedNodes.length; i++) {
          if (!isOwnDecorNode(m.addedNodes[i])) return true;
        }
        return false;
      });
      if (hasForeignNodes) {
        scheduleSync();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function apply(subtheme, particlesEnabled) {
    var nextSubtheme = normalizeSubtheme(subtheme);
    var nextParticles = particlesEnabled === undefined ? currentState.particles : normalizeParticles(particlesEnabled);

    var changedSubtheme = nextSubtheme !== currentState.subtheme;
    currentState.subtheme = nextSubtheme;
    currentState.particles = nextParticles;

    clearBodySubthemeClasses(document.documentElement);
    clearBodySubthemeClasses(document.body);

    if (nextSubtheme !== 'none') {
      if (document.documentElement) {
        document.documentElement.classList.add('subtheme-' + nextSubtheme);
      }
      if (document.body) {
        document.body.classList.add('subtheme-' + nextSubtheme);
        if (nextParticles) {
          document.body.classList.add('subtheme-particles-on');
        }
      }
    }

    try {
      localStorage.setItem('siteSubtheme', nextSubtheme);
      localStorage.setItem('siteSubthemeParticles', nextParticles ? '1' : '0');
    } catch (e) {}

    if (!document.body) return;

    if (changedSubtheme || nextSubtheme === 'none') {
      removeAllDecorations();
    } else {
      var pLayer = document.querySelector('.holiday-particles-layer');
      if (!nextParticles && pLayer && pLayer.parentNode) {
        pLayer.parentNode.removeChild(pLayer);
      }
    }

    if (nextSubtheme !== 'none') {
      syncDomDecorations();
      ensureObserver();
    }
  }

  function initFromCache() {
    try {
      var cached = localStorage.getItem('siteSubtheme');
      var cachedParticles = localStorage.getItem('siteSubthemeParticles');
      if (cached && cached !== 'none') {
        apply(cached, cachedParticles !== '0');
      }
    } catch (e) {}
  }

  function playCalendarSnowball(cell) {
    if (!cell || currentState.subtheme !== 'new-year' ||
      typeof cell.animate !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var bounds = cell.getBoundingClientRect();
    var flightMs = 250;
    var burstMs = 320;
    var layer = document.createElement('span');
    layer.className = 'holiday-calendar-snowball';
    layer.setAttribute('aria-hidden', 'true');
    function moveToCell(rect) {
      layer.style.left = (rect.left + rect.width / 2) + 'px';
      layer.style.top = (rect.top + Math.min(24, rect.height / 2)) + 'px';
    }
    moveToCell(bounds);
    document.body.appendChild(layer);

    var ball = document.createElement('span');
    ball.className = 'holiday-snowball-flight';
    layer.appendChild(ball);
    var side = bounds.left < window.innerWidth / 2 ? 1 : -1;
    var flight = ball.animate([
      { transform: 'translate(' + (side * 86) + 'px, -66px) rotate(-100deg) scale(.55)', opacity: 0 },
      { opacity: 1, offset: .2 },
      { transform: 'translate(' + (side * 37) + 'px, -38px) rotate(-48deg) scale(.85)' },
      { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 }
    ], { duration: flightMs, easing: 'ease-in', fill: 'forwards' });

    var listeners = new AbortController();
    function cleanup() {
      listeners.abort();
      layer.remove();
    }
    function followCell() {
      if (cell.isConnected) moveToCell(cell.getBoundingClientRect());
      else cleanup();
    }
    window.addEventListener('scroll', followCell, { capture: true, passive: true, signal: listeners.signal });
    window.addEventListener('resize', followCell, { signal: listeners.signal });

    flight.onfinish = function () {
      if (!layer.isConnected) return;
      ball.remove();
      for (var i = 0; i < 12; i++) {
        var crumb = document.createElement('span');
        crumb.className = 'holiday-snowball-crumb';
        var size = 3 + (i * 7 % 6);
        crumb.style.width = crumb.style.height = size + 'px';
        layer.appendChild(crumb);
        var angle = i * Math.PI / 6;
        var distance = 17 + (i * 11 % 24);
        var x = Math.cos(angle) * distance;
        var y = Math.sin(angle) * distance;
        crumb.animate([
          { transform: 'translate(0, 0)', opacity: 1 },
          { transform: 'translate(' + x * .75 + 'px,' + y * .75 + 'px)', opacity: .85, offset: .5 },
          { transform: 'translate(' + x + 'px,' + (y + 14) + 'px) scale(.4)', opacity: 0 }
        ], { duration: burstMs, easing: 'ease-out', fill: 'forwards' }).onfinish = i === 11 ? cleanup : null;
      }
    };
    return flightMs + burstMs;
  }

  window.EcoHolidayThemes = {
    SUBTHEMES: SUBTHEMES,
    META: META,
    THEME_ASSETS: THEME_ASSETS,
    apply: apply,
    playCalendarSnowball: playCalendarSnowball,
    getState: function () {
      return { subtheme: currentState.subtheme, particles: currentState.particles };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFromCache);
  } else {
    initFromCache();
  }
})();
