/**
 * Cabin Details Page Logic (cabin.js)
 * Implements the approved design composition, dynamic data binding,
 * categorized amenities, and responsive lightbox gallery.
 */

(function () {
  'use strict';

  let currentCabin = null;
  let galleryItems = []; // Array of all images available for the lightbox
  let currentLightboxIndex = 0;
  let lastFocusedElement = null;

  // Default photo captions for interior & exterior matching the approved sample
  const DEFAULT_INTERIOR_CAPTIONS = [
    'Вид с террасы',
    'Гостиная и обеденная зона',
    'Кухня',
    'Душевая',
    'Спальня',
    'Зона отдыха',
    'Интерьер дома',
    'Уютная спальня'
  ];

  const DEFAULT_EXTERIOR_CAPTIONS = [
    'Терраса дома',
    'Дом среди берёз',
    'Вход в дом',
    'Двор и прогулочные дорожки',
    'Территория у дома',
    'Вечернее освещение',
    'Дорожка к дому',
    'Вечер во дворе',
    'Зона отдыха на территории',
    'Тропинка среди деревьев',
    'Природа вокруг'
  ];

  document.addEventListener('DOMContentLoaded', async () => {
    try { sessionStorage.setItem('eco_splash_seen', '1'); } catch (e) {}
    initMobileNav();
    initLightboxEvents();

    const mainpagePromise = loadMainpageSettings();
    mainpagePromise.then(applyBrandAndContacts).catch(() => {});

    const urlParams = new URLSearchParams(window.location.search);
    const cabinId = urlParams.get('id') || urlParams.get('slug');

    const contentEl = document.getElementById('cabinContent');
    if (!cabinId) {
      if (contentEl) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 140px 0; color: #CCC4B6;">Объект не найден. <a href="/" style="color: #C5AA67; text-decoration: underline; margin-left: 8px;">На главную</a></div>';
      }
      return;
    }

    try {
      const [cabins, mainpage, amenitiesMap, houseItems, cabinAddonsMap] = await Promise.all([
        EcoApi.get('/api/cabins').catch(() => []),
        mainpagePromise,
        EcoApi.getAmenities().catch(() => ({})),
        fetchHouseItems().catch(() => []),
        fetch('/api/cabin-addons').then(r => r.json()).then(j => j.data || {}).catch(() => ({}))
      ]);

      if (!cabins || !cabins.length) {
        throw new Error('Не удалось загрузить данные об объектах');
      }

      currentCabin = cabins.find(c => c.id === cabinId || c.slug === cabinId || String(c.id) === String(cabinId));
      if (!currentCabin) {
        if (contentEl) {
          contentEl.innerHTML = '<div style="text-align: center; padding: 140px 0; color: #CCC4B6;">Объект не найден. <a href="/" style="color: #C5AA67; text-decoration: underline; margin-left: 8px;">На главную</a></div>';
        }
        return;
      }

      if (!currentCabin.addons && cabinAddonsMap && cabinAddonsMap[currentCabin.id]) {
        currentCabin.addons = cabinAddonsMap[currentCabin.id];
      }

      document.title = `${currentCabin.name} — аренда на сутки | ${getBrandName(mainpage)}`;
      applyBrandAndContacts(mainpage);

      const cabin = currentCabin;
      const cabinAmenities = amenitiesMap[cabinId]
        || (Array.isArray(cabin.amenities) ? cabin.amenities : []);

      renderCabinPage(currentCabin, cabinAmenities, houseItems, mainpage);

    } catch (err) {
      console.error('[cabin.js] Ошибка при инициализации страницы:', err);
      if (contentEl) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 140px 0; color: #ff8c8c;">Не удалось загрузить данные об объекте. Попробуйте обновить страницу.</div>';
      }
    }
  });

  /* -------------------------------------------------------------------------
     Brand & Settings Helpers
     ------------------------------------------------------------------------- */
  async function loadMainpageSettings() {
    try {
      const res = await fetch('/api/mainpage', { cache: 'no-store' });
      const json = await res.json();
      return json && json.data ? json.data : {};
    } catch {
      return {};
    }
  }

  async function fetchHouseItems() {
    try {
      const res = await fetch('/api/house-items');
      const json = await res.json();
      return json && json.data ? json.data : [];
    } catch {
      return [];
    }
  }

  function getBrandName(mainpage) {
    return (mainpage && mainpage.logo && mainpage.logo.text) ? mainpage.logo.text : 'Eco-Gorniy';
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/[^0-9+]/g, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function resolveMediaUrl(url) {
    if (!url) return '';
    return window.EcoMedia ? window.EcoMedia.url(url) : url;
  }

  function applyBrandAndContacts(mainpage) {
    const brandName = getBrandName(mainpage);
    const logo = (mainpage && mainpage.logo) || {};
    const contacts = (mainpage && mainpage.contacts) || {};

    const logoTextEl = document.getElementById('cabin-logo-text');
    if (logoTextEl) logoTextEl.textContent = brandName;

    const logoImgEl = document.getElementById('cabin-logo-img');
    if (logoImgEl) {
      if (logo.url) {
        const proxied = resolveMediaUrl(logo.url);
        logoImgEl.innerHTML = `<img src="${escapeHtml(proxied)}" alt="${escapeHtml(brandName)}">`;
        logoImgEl.style.background = 'none';
        logoImgEl.style.border = 'none';
      } else {
        logoImgEl.textContent = (logo.text || brandName || 'EG').slice(0, 2).toUpperCase();
      }
    }

    if (contacts.slogan) {
      const sloganEl = document.getElementById('cabin-logo-slogan');
      if (sloganEl) sloganEl.textContent = contacts.slogan;
    }
  }

  /* -------------------------------------------------------------------------
     Mobile Navigation Toggle & Smooth Anchor Scroll
     ------------------------------------------------------------------------- */
  function initMobileNav() {
    const menuBtn = document.getElementById('cabinMenuBtn');
    const nav = document.getElementById('cabinNav');

    if (menuBtn && nav) {
      menuBtn.addEventListener('click', () => {
        nav.classList.toggle('mobile-open');
      });

      nav.querySelectorAll('.cabin-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
          nav.classList.remove('mobile-open');
          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            const target = document.querySelector(href);
            if (target) {
              e.preventDefault();
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });
      });
    }

    // Scrollspy to highlight active link
    window.addEventListener('scroll', () => {
      const sections = ['about', 'amenities', 'interior', 'exterior', 'pricing'];
      const scrollPos = window.scrollY + 160;

      sections.forEach(id => {
        const section = document.getElementById(id);
        const link = document.querySelector(`.cabin-nav-link[href="#${id}"]`);
        if (section && link) {
          const top = section.offsetTop;
          const height = section.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        }
      });
    }, { passive: true });
  }

  /* -------------------------------------------------------------------------
     Amenity Grouping
     ------------------------------------------------------------------------- */
  function categorizeAmenities(cabin, cabinAmenities, houseItems) {
    const activeHouseItems = (houseItems || []).filter(item => item.is_active !== false);

    // If custom categories are configured in addons, use them directly
    const customCats = cabin?.addons?.categories;
    if (Array.isArray(customCats) && customCats.length > 0) {
      const result = customCats.map(cat => {
        const items = (cat.items || []).map(name => {
          const meta = activeHouseItems.find(h => h.name === name) || {};
          let icon = meta.icon || 'check';
          if (icon === 'check' || !icon) {
            const lower = name.toLowerCase();
            if (/кровать/i.test(lower)) icon = 'bed-double';
            else if (/диван/i.test(lower)) icon = 'sofa';
            else if (/террас|веранд/i.test(lower)) icon = 'home';
            else if (/саун|бан|парн/i.test(lower)) icon = 'flame';
            else if (/душ|ванн/i.test(lower)) icon = 'shower-head';
            else if (/посуд/i.test(lower)) icon = 'coffee';
            else if (/фен/i.test(lower)) icon = 'wind';
            else if (/wifi|wi-fi/i.test(lower)) icon = 'wifi';
            else if (/кухн|плит|чайник/i.test(lower)) icon = 'utensils';
          }
          return { name, icon };
        });
        let catIcon = cat.icon;
        if (!catIcon) {
          const catTitleLower = (cat.name || '').toLowerCase();
          if (/отдых|спальн|зал/i.test(catTitleLower)) catIcon = 'sofa';
          else if (/тепл|забот|бан|саун/i.test(catTitleLower)) catIcon = 'flame';
          else if (/быт|кухн/i.test(catTitleLower)) catIcon = 'utensils';
          else if (/пляж|вод/i.test(catTitleLower)) catIcon = 'waves';
          else catIcon = 'sparkles';
        }
        return {
          id: cat.id || 'cat_' + Math.random().toString(36).slice(2, 6),
          title: cat.name || 'Удобства',
          icon: catIcon,
          items
        };
      }).filter(grp => grp.items.length > 0);

      if (result.length > 0) return result;
    }

    // Group definition with default icons
    const groups = {
      lounge: {
        id: 'lounge',
        title: 'Зона отдыха',
        icon: 'bed',
        items: []
      },
      care: {
        id: 'care',
        title: 'Тепло и забота',
        icon: 'flame',
        items: []
      },
      comfort: {
        id: 'comfort',
        title: 'Бытовые удобства',
        icon: 'utensils',
        items: []
      }
    };

    // Filter valid amenities for this cabin
    const validNames = (cabinAmenities || []).filter(name => {
      if (!name) return false;
      const found = activeHouseItems.find(h => h.name === name);
      return !found || found.is_active !== false;
    });

    validNames.forEach(name => {
      const meta = activeHouseItems.find(h => h.name === name) || {};
      const lower = name.toLowerCase();

      // Determine appropriate Lucide icon
      let icon = meta.icon || 'check';
      if (icon === 'check' || !icon) {
        if (/кровать/i.test(lower)) icon = 'bed-double';
        else if (/диван/i.test(lower)) icon = 'sofa';
        else if (/террас|веранд/i.test(lower)) icon = 'home';
        else if (/саун|бан|парн/i.test(lower)) icon = 'flame';
        else if (/душ|ванн/i.test(lower)) icon = 'shower-head';
        else if (/посуд/i.test(lower)) icon = 'coffee';
        else if (/фен/i.test(lower)) icon = 'wind';
        else if (/wifi|wi-fi/i.test(lower)) icon = 'wifi';
        else if (/кухн|плит|чайник/i.test(lower)) icon = 'utensils';
      }

      const itemObj = { name, icon };

      // Check if item has explicit category from admin
      if (meta.category) {
        const catLower = meta.category.toLowerCase();
        if (catLower.includes('отдых') || catLower.includes('спальн') || catLower.includes('зона')) {
          groups.lounge.items.push(itemObj);
          return;
        } else if (catLower.includes('тепл') || catLower.includes('забот') || catLower.includes('бан') || catLower.includes('саун')) {
          groups.care.items.push(itemObj);
          return;
        } else if (catLower.includes('быт') || catLower.includes('удобств') || catLower.includes('кухн')) {
          groups.comfort.items.push(itemObj);
          return;
        }
      }

      // Smart semantic fallback
      if (/кровать|диван|террас|кресл|зона|балкон|шезлонг|спальн|беседк/i.test(lower)) {
        groups.lounge.items.push(itemObj);
      } else if (/саун|бан|душ|ванн|хаммам|полотенц|халат|чан|тепл/i.test(lower)) {
        groups.care.items.push(itemObj);
      } else {
        groups.comfort.items.push(itemObj);
      }
    });

    return [groups.lounge, groups.care, groups.comfort];
  }

  /* -------------------------------------------------------------------------
     Main Page Rendering
     ------------------------------------------------------------------------- */
  function renderCabinPage(cabin, cabinAmenities, houseItems, mainpage) {
    const contentEl = document.getElementById('cabinContent');
    if (!contentEl) return;

    const rawImages = Array.isArray(cabin.images) ? cabin.images : [];
    
    // Find main image
    const mainImgObj = rawImages.find(img => img.category === 'main') || rawImages[0] || null;
    const mainImageUrl = mainImgObj && mainImgObj.url ? resolveMediaUrl(mainImgObj.url) : '';

    // Split interior and exterior
    const interiorList = rawImages.filter(img => img.category === 'interior');
    const exteriorList = rawImages.filter(img => img.category === 'exterior');

    // Pick "About" image: first exterior or terrace photo, or fallback to main
    const aboutImgObj = exteriorList[0] || mainImgObj || {};
    const aboutImageUrl = aboutImgObj.url ? resolveMediaUrl(aboutImgObj.url) : mainImageUrl;

    // Categorized amenities
    const amenityGroups = categorizeAmenities(cabin, cabinAmenities, houseItems);

    // Global image registry for Lightbox
    galleryItems = [];

    // Contacts
    const contacts = (mainpage && mainpage.contacts) || {};
    const phoneDisplay = contacts.phone || '+7 (991) 242-19-70';
    const phoneHref = 'tel:' + normalizePhone(phoneDisplay);
    const emailDisplay = contacts.email || 'ecogorniy@gmail.com';
    const emailHref = 'mailto:' + emailDisplay;

    // Booking URL (preserves original site booking calendar workflow)
    const bookingUrl = `/?cabin=${encodeURIComponent(cabin.id)}#calendar`;

    const addons = cabin.addons || {};

    // Hero texts
    const heroTitleHtml = addons.hero_title
      ? escapeHtml(addons.hero_title).replace(/\n/g, '<br>')
      : escapeHtml(cabin.name || 'Объект размещения');
    const heroSubtitle = addons.hero_subtitle || cabin.description || '';
    const heroBtnText = addons.hero_btn || 'ЗАБРОНИРОВАТЬ';

    // 3 Highlights (render only if configured or fallback to capacity)
    const highlightCards = [];
    if (addons.highlight_1?.title) {
      highlightCards.push({ title: addons.highlight_1.title, sub: addons.highlight_1.sub || '', icon: addons.highlight_1.icon || 'users' });
    }
    if (addons.highlight_2?.title) {
      highlightCards.push({ title: addons.highlight_2.title, sub: addons.highlight_2.sub || '', icon: addons.highlight_2.icon || 'sparkles' });
    }
    if (addons.highlight_3?.title) {
      highlightCards.push({ title: addons.highlight_3.title, sub: addons.highlight_3.sub || '', icon: addons.highlight_3.icon || 'home' });
    }
    if (highlightCards.length === 0 && cabin.capacity) {
      highlightCards.push({ title: `До ${cabin.capacity} гостей`, sub: 'ВМЕСТИМОСТЬ', icon: 'users' });
    }

    // About section
    const aboutTitleHtml = addons.about_title
      ? escapeHtml(addons.about_title).replace(/\n/g, '<br>')
      : 'О месте';
    const aboutDescription = addons.about_desc || cabin.description || '';
    const badgeIcon = addons.badge_icon || 'map-pin';
    const badgeText = addons.badge_text || '';

    let html = '';

    /* 1. Hero Section */
    html += `
      <section class="cabin-hero" id="hero">
        <div class="cabin-hero-grid">
          <div class="cabin-hero-left">
            <div class="cabin-hero-kicker">— ${escapeHtml(cabin.name.toUpperCase())} · АРЕНДА</div>
            <h1 class="cabin-hero-title">
              ${heroTitleHtml}
            </h1>
            ${heroSubtitle ? `<p class="cabin-hero-desc">${escapeHtml(heroSubtitle)}</p>` : ''}
            <div class="cabin-hero-actions">
              <a href="${bookingUrl}" class="cabin-btn-gold">
                <span>${escapeHtml(heroBtnText)}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </a>
            </div>
          </div>
          <div class="cabin-hero-right">
            <div class="cabin-hero-photo-wrap">
              ${mainImageUrl ? `<img class="cabin-hero-photo" src="${escapeHtml(mainImageUrl)}" alt="${escapeHtml(cabin.name)}">` : ''}
            </div>
          </div>
        </div>
      </section>
    `;

    /* 2. Key Highlights Row */
    if (highlightCards.length > 0) {
      html += `
        <section class="cabin-highlights">
          ${highlightCards.map((hl, idx) => `
            ${idx > 0 ? '<div class="cabin-highlight-divider"></div>' : ''}
            <div class="cabin-highlight-item">
              <div class="cabin-highlight-icon">
                <i data-lucide="${escapeHtml(hl.icon)}"></i>
              </div>
              <div class="cabin-highlight-text">
                <div class="cabin-highlight-title">${escapeHtml(hl.title)}</div>
                ${hl.sub ? `<div class="cabin-highlight-sub">${escapeHtml(hl.sub)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </section>
      `;
    }

    /* 3. Section "О месте" */
    html += `
      <section class="cabin-section cabin-about" id="about">
        <div class="cabin-about-grid">
          <div class="cabin-about-photo-wrap">
            ${aboutImageUrl ? `<img class="cabin-about-photo" src="${escapeHtml(aboutImageUrl)}" alt="${escapeHtml(cabin.name)}">` : ''}
          </div>
          <div class="cabin-about-content">
            <div class="cabin-section-kicker">— ОПИСАНИЕ</div>
            <h2 class="cabin-about-title">
              ${aboutTitleHtml}
            </h2>
            ${aboutDescription ? `<p class="cabin-about-desc">${escapeHtml(aboutDescription)}</p>` : ''}
            ${badgeText ? `
            <div class="cabin-about-feature">
              <i data-lucide="${escapeHtml(badgeIcon)}" class="cabin-about-pin-icon"></i>
              <span>${escapeHtml(badgeText)}</span>
            </div>` : ''}
          </div>
        </div>
      </section>
    `;

    /* 4. Section "Что есть в домике" */
    html += `
      <section class="cabin-section cabin-amenities" id="amenities">
        <div class="cabin-section-header">
          <h2 class="cabin-section-heading">Что есть в домике</h2>
          <div class="cabin-section-subheading">КОМФОРТ В КАЖДОЙ ДЕТАЛИ</div>
        </div>
        <div class="cabin-section-divider"></div>
        <div class="cabin-amenities-groups">
          ${amenityGroups.map(group => `
            <div class="cabin-amenity-group">
              <div class="cabin-amenity-group-head">
                <div class="cabin-amenity-group-icon">
                  <i data-lucide="${group.icon}"></i>
                </div>
                <div class="cabin-amenity-group-title">${escapeHtml(group.title)}</div>
              </div>
              <div class="cabin-amenity-items">
                ${group.items.length > 0 ? group.items.map(it => `
                  <div class="cabin-amenity-item">
                    <i data-lucide="${escapeHtml(it.icon)}"></i>
                    <span>${escapeHtml(it.name)}</span>
                  </div>
                `).join('') : '<div style="color: var(--cp-text-muted); font-size: 14px;">Уточняется...</div>'}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;

    /* 5. Section "Интерьер" */
    if (interiorList.length > 0) {
      const interiorStartIndex = galleryItems.length;
      interiorList.forEach((img, idx) => {
        const caption = img.title || DEFAULT_INTERIOR_CAPTIONS[idx] || `Интерьер ${idx + 1}`;
        galleryItems.push({
          url: resolveMediaUrl(img.url),
          caption
        });
      });

      html += `
        <section class="cabin-section cabin-gallery-sec" id="interior">
          <div class="cabin-section-header">
            <h2 class="cabin-section-heading">Интерьер</h2>
            <div class="cabin-section-subheading">${interiorList.length} ${pluralizePhotos(interiorList.length)}</div>
          </div>
          <div class="cabin-section-divider"></div>
          <div class="cabin-photo-grid">
            ${interiorList.map((img, idx) => {
              const globalIdx = interiorStartIndex + idx;
              const caption = galleryItems[globalIdx].caption;
              const imgUrl = galleryItems[globalIdx].url;
              return `
                <div class="cabin-photo-card" data-gallery-index="${globalIdx}" tabindex="0" role="button" aria-label="Открыть фото: ${escapeHtml(caption)}">
                  <img src="${escapeHtml(imgUrl)}" loading="lazy" alt="${escapeHtml(caption)}">
                  <div class="cabin-photo-card-footer">
                    <div class="cabin-photo-card-title">${escapeHtml(caption)}</div>
                    <div class="cabin-photo-card-expand">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                      </svg>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }

    /* 6. Section "Экстерьер и территория" */
    if (exteriorList.length > 0) {
      const exteriorStartIndex = galleryItems.length;
      exteriorList.forEach((img, idx) => {
        const caption = img.title || DEFAULT_EXTERIOR_CAPTIONS[idx] || `Территория ${idx + 1}`;
        galleryItems.push({
          url: resolveMediaUrl(img.url),
          caption
        });
      });

      html += `
        <section class="cabin-section cabin-gallery-sec" id="exterior">
          <div class="cabin-section-header">
            <h2 class="cabin-section-heading">Экстерьер и территория</h2>
            <div class="cabin-section-subheading">${exteriorList.length} ${pluralizePhotos(exteriorList.length)}</div>
          </div>
          <div class="cabin-section-divider"></div>
          <div class="cabin-photo-grid">
            ${exteriorList.map((img, idx) => {
              const globalIdx = exteriorStartIndex + idx;
              const caption = galleryItems[globalIdx].caption;
              const imgUrl = galleryItems[globalIdx].url;
              return `
                <div class="cabin-photo-card" data-gallery-index="${globalIdx}" tabindex="0" role="button" aria-label="Открыть фото: ${escapeHtml(caption)}">
                  <img src="${escapeHtml(imgUrl)}" loading="lazy" alt="${escapeHtml(caption)}">
                  <div class="cabin-photo-card-footer">
                    <div class="cabin-photo-card-title">${escapeHtml(caption)}</div>
                    <div class="cabin-photo-card-expand">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                      </svg>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }

    /* 7. Section "Стоимость и действие" */
    html += `
      <section class="cabin-pricing-section" id="pricing">
        <div class="cabin-pricing-card">
          <div class="cabin-pricing-left">
            <div class="cabin-pricing-rate">
              <span class="cabin-rate-prefix">от</span>
              <span class="cabin-rate-amount">${EcoApi.formatPrice(cabin.base_price)}</span>
              <span class="cabin-rate-suffix">/ сутки</span>
            </div>
            <div class="cabin-pricing-contacts">
              <a href="${phoneHref}" class="cabin-contact-item">
                <i data-lucide="phone"></i>
                <span>${escapeHtml(phoneDisplay)}</span>
              </a>
              <a href="${emailHref}" class="cabin-contact-item">
                <i data-lucide="mail"></i>
                <span>${escapeHtml(emailDisplay)}</span>
              </a>
            </div>
          </div>
          <div class="cabin-pricing-right">
            <a href="${bookingUrl}" class="cabin-btn-gold cabin-btn-lg">
              <span>ВЫБРАТЬ ДАТЫ</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </a>
          </div>
        </div>
      </section>
    `;

    contentEl.innerHTML = html;

    // Attach card click handlers for Lightbox
    contentEl.querySelectorAll('.cabin-photo-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.getAttribute('data-gallery-index'), 10);
        openLightbox(idx, card);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const idx = parseInt(card.getAttribute('data-gallery-index'), 10);
          openLightbox(idx, card);
        }
      });
    });

    // Render Lucide icons
    if (window.lucide) {
      setTimeout(() => {
        window.lucide.createIcons({ root: contentEl, nameAttr: 'data-lucide' });
      }, 50);
    }
  }

  function pluralizePhotos(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;
    if (lastTwo >= 11 && lastTwo <= 19) return 'ФОТОГРАФИЙ';
    if (lastOne === 1) return 'ФОТОГРАФИЯ';
    if (lastOne >= 2 && lastOne <= 4) return 'ФОТОГРАФИИ';
    return 'ФОТОГРАФИЙ';
  }

  /* -------------------------------------------------------------------------
     Lightbox (Modal Photo Gallery)
     ------------------------------------------------------------------------- */
  function initLightboxEvents() {
    const modal = document.getElementById('cabinLightbox');
    const closeBtn = document.getElementById('lightboxCloseBtn');
    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');

    if (!modal) return;

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', showPrevLightboxPhoto);
    if (nextBtn) nextBtn.addEventListener('click', showNextLightboxPhoto);

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.id === 'lightboxBlurBg') {
        closeLightbox();
      }
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('is-active')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        showPrevLightboxPhoto();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        showNextLightboxPhoto();
      }
    });

    // Touch swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    modal.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    modal.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          showPrevLightboxPhoto();
        } else {
          showNextLightboxPhoto();
        }
      }
    }
  }

  function openLightbox(index, triggerElement) {
    if (!galleryItems || !galleryItems.length) return;
    lastFocusedElement = triggerElement || document.activeElement;

    currentLightboxIndex = (index >= 0 && index < galleryItems.length) ? index : 0;
    updateLightboxContent();

    const modal = document.getElementById('cabinLightbox');
    if (modal) {
      modal.classList.add('is-active');
      document.body.style.overflow = 'hidden';
      const closeBtn = document.getElementById('lightboxCloseBtn');
      if (closeBtn) closeBtn.focus();
    }
  }

  function closeLightbox() {
    const modal = document.getElementById('cabinLightbox');
    if (modal) {
      modal.classList.remove('is-active');
      document.body.style.overflow = '';
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      }
    }
  }

  function showPrevLightboxPhoto() {
    if (!galleryItems.length) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + galleryItems.length) % galleryItems.length;
    updateLightboxContent();
  }

  function showNextLightboxPhoto() {
    if (!galleryItems.length) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % galleryItems.length;
    updateLightboxContent();
  }

  function updateLightboxContent() {
    if (!galleryItems.length) return;
    const item = galleryItems[currentLightboxIndex];

    const imgEl = document.getElementById('lightboxImg');
    const captionEl = document.getElementById('lightboxCaption');
    const counterEl = document.getElementById('lightboxCounter');
    const blurBgEl = document.getElementById('lightboxBlurBg');

    if (imgEl) {
      imgEl.src = item.url;
      imgEl.alt = item.caption || 'Фотография';
    }
    if (captionEl) captionEl.textContent = item.caption || '';
    if (counterEl) counterEl.textContent = `${currentLightboxIndex + 1} / ${galleryItems.length}`;
    if (blurBgEl) blurBgEl.style.backgroundImage = `url("${item.url}")`;
  }

})();
