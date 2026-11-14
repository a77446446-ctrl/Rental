/**
 * Модуль праздничных и сезонных подтем (EcoHolidayThemes)
 * Размещает готовые SVG-иллюстрации из /seasonal-decor/<theme>/ поверх выбранной цветовой темы:
 * шапка, углы экрана, логотипы, главный баннер, блоки/карточки, кнопки, подписи, частицы и правый нижний акцент.
 */
(function () {
  'use strict';

  var SUBTHEMES = ['none', 'new-year', 'feb23', 'mar8', 'spring', 'may1', 'sep1', 'nov4'];
  var ASSET_BASE = '/seasonal-decor/';
  var ASSET_VERSION = '?v=20261114-2';

  var META = {
    'none': {
      label: 'Выключено',
      description: 'Стандартный вид сайта без сезонного декора'
    },
    'new-year': {
      label: 'Новый год и Рождество',
      description: 'Дед Мороз, еловая гирлянда с игрушками, снежные шапки, сосульки, шишка и снежинки'
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
      blockEdge: 'block-edge.svg',
      blockEdgeHero: 'snow-and-icicles.svg',
      blockEdgeAlt: 'icicles-edge.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg', 'snowflake-detail.svg'],
      cardCornerRight: 'ornament-pinecone.svg',
      cardBottomLeft: 'ornaments-pair.svg',
      bannerExtra: 'garland-red.svg',
      buttonCharm: 'snowflake-detail.svg',
      textDecor: 'garland-red.svg'
    },
    'feb23': {
      folder: 'february-23',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      blockEdgeHero: 'block-edge.svg',
      blockEdgeAlt: 'olive-ribbon.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'laurel-star.svg',
      cardBottomLeft: 'laurel-sprig.svg',
      bannerExtra: 'laurel-star.svg',
      buttonCharm: 'logo-charm.svg',
      textDecor: 'olive-ribbon.svg'
    },
    'mar8': {
      folder: 'march-8',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      blockEdgeHero: 'block-edge.svg',
      blockEdgeAlt: 'header.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'mimosa-sprig.svg',
      cardBottomLeft: 'tulip-bouquet.svg',
      bannerExtra: 'tulip-bouquet.svg',
      buttonCharm: 'tulip-stem.svg',
      textDecor: 'mimosa-sprig.svg'
    },
    'spring': {
      folder: 'spring',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      blockEdgeHero: 'block-edge.svg',
      blockEdgeAlt: 'header.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'birch-sprig.svg',
      cardBottomLeft: 'snowdrop.svg',
      bannerExtra: 'birch-sprig.svg',
      buttonCharm: 'dewy-leaf.svg',
      textDecor: 'birch-sprig.svg'
    },
    'may1': {
      folder: 'may-1',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      blockEdgeHero: 'block-edge.svg',
      blockEdgeAlt: 'fabric-flags.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'fabric-flags.svg',
      cardBottomLeft: 'apple-blossom.svg',
      bannerExtra: 'apple-blossom.svg',
      buttonCharm: 'ribbon-knot.svg',
      textDecor: 'fabric-flags.svg'
    },
    'sep1': {
      folder: 'september-1',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      blockEdgeHero: 'block-edge.svg',
      blockEdgeAlt: 'header.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'rowan-sprig.svg',
      cardBottomLeft: 'maple-sprig.svg',
      bannerExtra: 'maple-sprig.svg',
      buttonCharm: 'maple-leaf.svg',
      textDecor: 'rowan-sprig.svg'
    },
    'nov4': {
      folder: 'november-4',
      header: 'header.svg',
      blockEdge: 'block-edge.svg',
      blockEdgeHero: 'block-edge.svg',
      blockEdgeAlt: 'tricolor-ribbon.svg',
      cornerLeft: 'corner-left.svg',
      cornerRight: 'corner-right.svg',
      logoCharm: 'logo-charm.svg',
      accent: 'accent.svg',
      particles: ['particle.svg', 'particle-alt.svg'],
      cardCornerRight: 'oak-sprig.svg',
      cardBottomLeft: 'tricolor-bow.svg',
      bannerExtra: 'tricolor-ribbon.svg',
      buttonCharm: 'tricolor-bow.svg',
      textDecor: 'tricolor-ribbon.svg'
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
    var count = 20;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'holiday-particle';

      var leftPct = ((i * 37 + 11) % 94) + 2;
      var sizePx = 15 + ((i * 5) % 12);
      var durSec = 9 + ((i * 3) % 7);
      var delaySec = -((i * 1.7) % 10);
      var swaySec = 2.8 + (i % 4) * 0.7;
      var driftPx = (i % 2 === 0 ? 1 : -1) * (24 + (i % 5) * 14);
      var opacityVal = 0.65 + (i % 4) * 0.09;

      p.style.setProperty('--p-left', leftPct + '%');
      p.style.setProperty('--p-size', sizePx + 'px');
      p.style.setProperty('--p-dur', durSec.toFixed(1) + 's');
      p.style.setProperty('--p-delay', delaySec.toFixed(1) + 's');
      p.style.setProperty('--p-sway-dur', swaySec.toFixed(1) + 's');
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
    if (!document.body || !assets) return;
    if (document.querySelector('.holiday-screen-corners')) return;

    var container = document.createElement('div');
    container.className = 'holiday-screen-corners';
    container.setAttribute('aria-hidden', 'true');

    container.appendChild(
      createDecorBox('holiday-screen-top-garland', assetUrl(subtheme, assets.header))
    );
    container.appendChild(
      createDecorBox('holiday-corner-branch holiday-corner-branch--left', assetUrl(subtheme, assets.cornerLeft))
    );
    container.appendChild(
      createDecorBox('holiday-corner-branch holiday-corner-branch--right', assetUrl(subtheme, assets.cornerRight))
    );

    document.body.appendChild(container);
  }

  /* ========================================================================
     3. Крупный акцент (Дед Мороз / праздничная композиция) в правом нижнем углу и в админ-превью
     ======================================================================== */
  function renderCornerMascot(subtheme) {
    var assets = getAssets(subtheme);
    if (!document.body || !assets || !assets.accent) return;

    var accentSrc = assetUrl(subtheme, assets.accent);

    if (!document.querySelector('.holiday-corner-mascot')) {
      var mascot = createDecorBox('holiday-corner-mascot', accentSrc, 'holiday-mascot-img');
      document.body.appendChild(mascot);
    }

    var previewArea = document.getElementById('previewArea');
    if (previewArea && !previewArea.querySelector('.holiday-corner-mascot-inline')) {
      var inlineMascot = createDecorBox('holiday-corner-mascot-inline', accentSrc, 'holiday-mascot-img');
      previewArea.appendChild(inlineMascot);
    }
  }

  /* ========================================================================
     4. Декор шапки сайта (.header, .cabin-header, .admin-header)
     ======================================================================== */
  function decorateHeaders(subtheme) {
    var assets = getAssets(subtheme);
    if (!assets) return;

    var headerSrc = assetUrl(subtheme, assets.header);
    var edgeSrc = assetUrl(subtheme, assets.blockEdge);

    document.querySelectorAll('.header, .cabin-header, .admin-header').forEach(function (header) {
      if (header.getAttribute('data-holiday-subtheme') === subtheme) return;
      var old = header.querySelector('.holiday-header-decor');
      if (old) old.remove();

      var decor = document.createElement('div');
      decor.className = 'holiday-header-decor';
      decor.setAttribute('aria-hidden', 'true');
      decor.appendChild(createDecorImg(headerSrc, 'holiday-header-garland'));
      if (edgeSrc) {
        decor.appendChild(createDecorImg(edgeSrc, 'holiday-header-edge'));
      }

      header.setAttribute('data-holiday-subtheme', subtheme);
      header.appendChild(decor);
    });
  }

  /* ========================================================================
     5. Значок возле логотипа (#main-logo-link, #cabinBrandLink, .admin-brand, .footer-brand)
     ======================================================================== */
  function decorateLogos(subtheme) {
    var assets = getAssets(subtheme);
    if (!assets || !assets.logoCharm) return;

    var charmSrc = assetUrl(subtheme, assets.logoCharm);
    document.querySelectorAll('#main-logo-link, #cabinBrandLink, .admin-brand, .footer-brand').forEach(function (logo) {
      if (logo.getAttribute('data-holiday-subtheme') === subtheme) return;
      var old = logo.querySelector('.holiday-logo-badge');
      if (old) old.remove();

      var badge = document.createElement('span');
      badge.className = 'holiday-logo-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.appendChild(createDecorImg(charmSrc, 'holiday-logo-badge-img'));

      logo.setAttribute('data-holiday-subtheme', subtheme);
      logo.appendChild(badge);
    });
  }

  /* ========================================================================
     6. Главный баннер, предпросмотр админки и сцена территории
     ======================================================================== */
  function decorateBanner(container, subtheme) {
    var assets = getAssets(subtheme);
    if (!container || !assets) return;
    if (container.getAttribute('data-holiday-subtheme') === subtheme) return;

    var old = container.querySelector('.holiday-banner-decor');
    if (old) old.remove();

    var decor = document.createElement('div');
    decor.className = 'holiday-banner-decor';
    decor.setAttribute('aria-hidden', 'true');

    decor.appendChild(
      createDecorBox('holiday-banner-edge', assetUrl(subtheme, assets.blockEdgeHero || assets.blockEdge))
    );
    decor.appendChild(
      createDecorBox('holiday-banner-garland', assetUrl(subtheme, assets.header))
    );
    decor.appendChild(
      createDecorBox('holiday-banner-left', assetUrl(subtheme, assets.cornerLeft))
    );
    decor.appendChild(
      createDecorBox('holiday-banner-right', assetUrl(subtheme, assets.cornerRight))
    );

    if (assets.bannerExtra) {
      decor.appendChild(
        createDecorBox('holiday-banner-extra', assetUrl(subtheme, assets.bannerExtra))
      );
    }

    // Большой акцент (включая Деда Мороза) на главном баннере .hero-stage
    if (assets.accent && container.classList && container.classList.contains('hero-stage')) {
      decor.appendChild(
        createDecorBox('holiday-banner-accent', assetUrl(subtheme, assets.accent))
      );
    }

    container.setAttribute('data-holiday-subtheme', subtheme);
    container.appendChild(decor);
  }

  /* ========================================================================
     7. Карточки и контентные блоки
     ======================================================================== */
  function decorateCard(card, subtheme, options) {
    var assets = getAssets(subtheme);
    if (!card || !assets) return;
    if (card.getAttribute('data-holiday-subtheme') === subtheme) return;

    var old = card.querySelector('.holiday-card-decor');
    if (old) old.remove();

    var opts = options || {};
    var decor = document.createElement('div');
    decor.className = 'holiday-card-decor';
    decor.setAttribute('aria-hidden', 'true');

    var edgeFile = opts.useHeroEdge
      ? (assets.blockEdgeHero || assets.blockEdge)
      : (opts.useAltEdge ? (assets.blockEdgeAlt || assets.blockEdge) : assets.blockEdge);

    decor.appendChild(
      createDecorBox('holiday-block-edge', assetUrl(subtheme, edgeFile))
    );
    decor.appendChild(
      createDecorBox('holiday-card-top-left', assetUrl(subtheme, assets.cornerLeft))
    );

    var rightFile = opts.withRightCorner ? assets.cornerRight : (assets.cardCornerRight || assets.cornerRight);
    decor.appendChild(
      createDecorBox('holiday-card-top-right', assetUrl(subtheme, rightFile))
    );

    if (opts.withBottomAccent && assets.cardBottomLeft) {
      decor.appendChild(
        createDecorBox('holiday-card-bottom-left', assetUrl(subtheme, assets.cardBottomLeft))
      );
    }

    card.setAttribute('data-holiday-subtheme', subtheme);
    card.appendChild(decor);
  }

  /* ========================================================================
     8. Декор кнопок (.btn-primary, .header-action)
     ======================================================================== */
  function decorateButtons(subtheme) {
    var assets = getAssets(subtheme);
    if (!assets) return;

    var charmSrc = assetUrl(subtheme, assets.buttonCharm || assets.logoCharm);
    var edgeSrc = assetUrl(subtheme, assets.blockEdge);

    document.querySelectorAll('.btn-primary, .header-action').forEach(function (btn) {
      if (btn.getAttribute('data-holiday-subtheme') === subtheme) return;
      var old = btn.querySelector('.holiday-btn-decor');
      if (old) old.remove();

      var decor = document.createElement('span');
      decor.className = 'holiday-btn-decor';
      decor.setAttribute('aria-hidden', 'true');

      if (subtheme === 'new-year' && edgeSrc) {
        decor.appendChild(createDecorImg(edgeSrc, 'holiday-btn-edge'));
      }
      if (charmSrc) {
        decor.appendChild(createDecorImg(charmSrc, 'holiday-btn-charm'));
      }

      btn.setAttribute('data-holiday-subtheme', subtheme);
      btn.appendChild(decor);
    });
  }

  /* ========================================================================
     9. Декор текстовых меток / заголовков (.section-label, .kicker)
     ======================================================================== */
  function decorateHeadings(subtheme) {
    var assets = getAssets(subtheme);
    if (!assets) return;

    document.querySelectorAll('.section-label, .kicker').forEach(function (label) {
      if (label.getAttribute('data-holiday-subtheme') === subtheme) return;
      var old = label.querySelector('.holiday-text-decor');
      if (old) old.remove();

      var isKicker = label.classList && label.classList.contains('kicker');
      var file = isKicker ? (assets.textDecor || assets.logoCharm) : (assets.logoCharm || assets.textDecor);
      if (!file) return;

      var badge = document.createElement('span');
      badge.className = 'holiday-text-decor' + (isKicker ? ' holiday-text-decor--wide' : '');
      badge.setAttribute('aria-hidden', 'true');
      badge.appendChild(createDecorImg(assetUrl(subtheme, file), 'holiday-text-decor-img'));

      label.setAttribute('data-holiday-subtheme', subtheme);
      label.appendChild(badge);
    });
  }

  function syncDomDecorations() {
    var subtheme = currentState.subtheme;
    if (!document.body || subtheme === 'none' || !getAssets(subtheme)) return;

    renderParticles(subtheme);
    renderScreenCorners(subtheme);
    renderCornerMascot(subtheme);
    decorateHeaders(subtheme);
    decorateLogos(subtheme);

    document.querySelectorAll('.hero-stage, #previewArea, .territory-stage').forEach(function (el) {
      decorateBanner(el, subtheme);
    });

    document.querySelectorAll('.house-card, .hero-booking, .calendar-card, .checkout-card, .cta-card, .feature-panel, .side-card, .review, .cabin-hero-card, .success-container').forEach(function (card) {
      var cl = card.classList;
      var isMajorBlock = cl.contains('hero-booking') || cl.contains('calendar-card') || cl.contains('checkout-card') || cl.contains('cta-card') || cl.contains('cabin-hero-card') || cl.contains('success-container');
      var isAltBlock = cl.contains('side-card') || cl.contains('review');
      var withRightCorner = cl.contains('cta-card') || cl.contains('calendar-card') || cl.contains('checkout-card') || cl.contains('cabin-hero-card') || cl.contains('success-container');
      var withBottomAccent = cl.contains('calendar-card') || cl.contains('cta-card') || cl.contains('feature-panel') || cl.contains('cabin-hero-card') || cl.contains('success-container');

      decorateCard(card, subtheme, {
        useHeroEdge: isMajorBlock,
        useAltEdge: isAltBlock,
        withRightCorner: withRightCorner,
        withBottomAccent: withBottomAccent
      });
    });

    decorateButtons(subtheme);
    decorateHeadings(subtheme);
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

  window.EcoHolidayThemes = {
    SUBTHEMES: SUBTHEMES,
    META: META,
    THEME_ASSETS: THEME_ASSETS,
    apply: apply,
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
