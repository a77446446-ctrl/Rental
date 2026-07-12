document.addEventListener('DOMContentLoaded', async () => {
  const mainpagePromise = loadCabinMainpage();
  mainpagePromise.then(applyCabinBrand).catch(() => {});

  const urlParams = new URLSearchParams(window.location.search);
  const cabinId = urlParams.get('id');

  if (!cabinId) {
    document.getElementById('cabinContent').innerHTML = '<div style="text-align: center; padding: 100px 0;">Домик не найден. <a href="/" style="color: var(--gold);">На главную</a></div>';
    return;
  }

  try {
    // Получаем список домиков (EcoApi.get возвращает массив данных напрямую)
    const cabins = await EcoApi.get('/api/cabins');
    const mainpage = await mainpagePromise;
    applyCabinBrand(mainpage);
    if (!cabins) throw new Error('Ошибка загрузки данных');
    
    const cabin = cabins.find(c => c.id == cabinId);
    if (!cabin) {
      document.getElementById('cabinContent').innerHTML = '<div style="text-align: center; padding: 100px 0;">Домик не найден. <a href="/" style="color: var(--gold);">На главную</a></div>';
      return;
    }

    // Получаем список удобств (привязанных к домикам)
    let amenitiesMap = {};
    try {
      amenitiesMap = await EcoApi.getAmenities();
    } catch (e) {
      console.warn('Не удалось загрузить удобства', e);
    }
    const cabinAmenities = amenitiesMap[cabinId] || [];
    
    let houseItems = [];
    try {
      const hiRes = await fetch('/api/house-items');
      const hiJson = await hiRes.json();
      if (hiJson && hiJson.data) houseItems = hiJson.data;
    } catch (e) {
      console.warn('Не удалось загрузить house items', e);
    }
    
    document.title = cabin.name + ' | ' + getBrandName(mainpage);
    renderCabinDetails(cabin, cabinAmenities, houseItems);

  } catch (err) {
    console.error(err);
    document.getElementById('cabinContent').innerHTML = '<div style="text-align: center; padding: 100px 0; color: #ff9898;">Ошибка при загрузке данных.</div>';
  }
});

let allImages = [];
let currentImageIndex = 0;

async function loadCabinMainpage() {
  try {
    const res = await fetch('/api/mainpage', { cache: 'no-store' });
    const json = await res.json();
    return json && json.data ? json.data : {};
  } catch (e) {
    console.warn('Не удалось загрузить настройки главной страницы', e);
    return {};
  }
}

function getBrandName(mainpage) { return (mainpage && mainpage.logo && mainpage.logo.text) ? mainpage.logo.text : 'EcoGorniy'; }

function normalizePhone(phone) { return String(phone || '').replace(/[^0-9+]/g, ''); }

function onlyDigits(value) { return String(value || '').replace(/\D/g, ''); }

function escapeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }

function setLogo(markEl, logo, brandName) {
  if (!markEl) return;
  const logoUrl = logo && logo.url ? String(logo.url).trim() : '';
  const logoText = logo && logo.text ? String(logo.text).trim() : '';
  if (logoUrl) {
    markEl.innerHTML = '<img src="' + escapeHtml(logoUrl) + '" alt="" loading="eager">';
    markEl.classList.add('has-image-logo');
    markEl.style.background = 'none';
    markEl.style.border = 'none';
    markEl.style.borderRadius = '0';
  } else {
    markEl.classList.remove('has-image-logo');
    markEl.textContent = (logoText || brandName || 'EG').slice(0, 2);
    markEl.style.background = '';
    markEl.style.border = '';
    markEl.style.borderRadius = '';
  }
}

function contactHref(type, value) { if (!value) return ''; const raw = String(value).trim(); if (/^https?:\/\//i.test(raw)) return raw; if (type === 'phone') return 'tel:' + normalizePhone(raw); if (type === 'email') return 'mailto:' + raw; if (type === 'whatsapp') return 'https://wa.me/' + onlyDigits(raw); if (type === 'telegram') return 'https://t.me/' + raw.replace(/^@/, ''); return raw; }

function applyCabinBrand(mainpage) {
  const brandName = getBrandName(mainpage);
  const logo = mainpage.logo || {};
  const contacts = mainpage.contacts || {};

  ['cabin-logo-text', 'cabin-footer-brand-name', 'cabin-footer-title'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = brandName;
  });

  setLogo(document.getElementById('cabin-logo-img'), logo, brandName);
  setLogo(document.getElementById('cabin-footer-brand-mark'), logo, brandName);

  const links = [];
  if (contacts.phone) links.push({ label: contacts.phone, href: contactHref('phone', contacts.phone) });
  if (contacts.telegram || contacts.telegram_url) links.push({ label: 'Telegram', href: contactHref('telegram', contacts.telegram_url || contacts.telegram) });
  if (contacts.whatsapp || contacts.whatsapp_url || contacts.phone) links.push({ label: 'WhatsApp', href: contactHref('whatsapp', contacts.whatsapp_url || contacts.whatsapp || contacts.phone) });
  if (contacts.email) links.push({ label: contacts.email, href: contactHref('email', contacts.email) });

  const linksEl = document.getElementById('cabin-contact-links');
  if (linksEl) linksEl.innerHTML = links.map(link => '<a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + '</a>').join('');
}

function renderCabinDetails(cabin, cabinAmenities, houseItems) {
  const mainImg = (cabin.images && cabin.images.length > 0) 
    ? cabin.images.find(img => img.category === 'main') || cabin.images[0] 
    : null;
  const heroImageStyle = mainImg && mainImg.url
    ? `background-image: url('${mainImg.url}');`
    : 'background-image: linear-gradient(180deg, rgba(237,228,214,.08), rgba(18,15,13,.86));';

  allImages = cabin.images || [];

  const interiorImages = allImages.filter(img => img.category === 'interior');
  const exteriorImages = allImages.filter(img => img.category === 'exterior');

  let html = `
    <div class="cabin-hero">
      <div class="cabin-hero-bg" style="${heroImageStyle}"></div>
      <div class="cabin-hero-overlay"></div>
      <div class="cabin-hero-content">
        <h1>${cabin.name}</h1>
        <div class="cabin-meta">
          <span class="chip">до ${cabin.capacity} гостей</span>
          <span class="chip">от ${EcoApi.formatPrice(cabin.base_price)} / сутки</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="cabin-details-grid">
        <div class="cabin-main-col">
          <div class="cabin-description">
            <h2 style="color: var(--gold); margin-bottom: 24px; font-size: 32px;">О месте</h2>
            <p>${cabin.description || 'Описание отсутствует.'}</p>
          </div>
        </div>
        
        <div class="cabin-sidebar-col">
          <div class="amenities-section">
            <h3>Что есть в домике</h3>
            <div class="amenities-list">
              ${cabinAmenities && cabinAmenities.length > 0 
                ? cabinAmenities.map(am => {
                    const hi = (houseItems || []).find(h => h.name === am);
                    const iconSvg = (hi && hi.icon) 
                      ? `<i data-lucide="${hi.icon}" style="width: 18px; height: 18px; color: var(--gold);"></i>`
                      : `<svg><path d="M5 13l4 4L19 7"></path></svg>`;
                    return `
                      <div class="amenity-item">
                        ${iconSvg}
                        ${am}
                      </div>
                    `;
                  }).join('')
                : '<div style="color: var(--muted); font-size: 15px;">Информация скоро появится...</div>'
              }
            </div>
          </div>
        </div>
      </div>

      ${interiorImages.length > 0 ? `
      <div class="photo-section">
        <h2>Интерьер</h2>
        <div class="photo-grid">
          ${interiorImages.map((img, idx) => `
            <div class="gallery-modal-item gallery-thumb" onclick="openFullscreenGallery(${allImages.indexOf(img)})">
              <img src="${img.url}" loading="lazy" alt="Интерьер">
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${exteriorImages.length > 0 ? `
      <div class="photo-section">
        <h2>Экстерьер и территория</h2>
        <div class="photo-grid">
          ${exteriorImages.map((img, idx) => `
            <div class="gallery-modal-item gallery-thumb" onclick="openFullscreenGallery(${allImages.indexOf(img)})">
              <img src="${img.url}" loading="lazy" alt="Экстерьер">
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <div class="floating-booking">
      <div class="price">
        ${EcoApi.formatPrice(cabin.base_price)} <span>/ сутки</span>
      </div>
      <a href="/?cabin=${cabin.id}#calendar" class="btn btn-primary" style="padding: 12px 32px;">Выбрать даты</a>
    </div>
  `;

  document.getElementById('cabinContent').innerHTML = html;
  
  if (window.lucide) {
    setTimeout(() => window.lucide.createIcons({ root: document.getElementById('cabinContent') }), 0);
  }
}

// Полноэкранная галерея
const galleryModal = document.getElementById('galleryModal');
const galleryModalBody = document.getElementById('galleryModalBody');
const galleryModalCount = document.getElementById('galleryModalCount');

window.openFullscreenGallery = function(index) {
  if (!allImages || allImages.length === 0) return;
  currentImageIndex = index;
  renderGalleryImage();
  galleryModal.classList.add('open');
};

document.getElementById('closeGalleryBtn').addEventListener('click', () => {
  galleryModal.classList.remove('open');
});

document.getElementById('galleryPrevBtn').addEventListener('click', () => {
  currentImageIndex = (currentImageIndex - 1 + allImages.length) % allImages.length;
  renderGalleryImage();
});

document.getElementById('galleryNextBtn').addEventListener('click', () => {
  currentImageIndex = (currentImageIndex + 1) % allImages.length;
  renderGalleryImage();
});

function renderGalleryImage() {
  const img = allImages[currentImageIndex];
  galleryModalCount.textContent = `${currentImageIndex + 1} / ${allImages.length}`;
  galleryModalBody.innerHTML = `
    <div style="position: absolute; inset: 0; background-image: url('${img.url}'); background-size: cover; background-position: center; filter: blur(40px) brightness(0.3); z-index: 1;"></div>
    <img src="${img.url}" style="max-width: 90%; max-height: 90vh; object-fit: contain; position: relative; z-index: 2; border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
  `;
}
