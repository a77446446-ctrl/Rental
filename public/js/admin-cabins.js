/**
 * Логика управления домиками (Admin Cabins)
 */

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('cabinsTableBody');
  const editModal = document.getElementById('editModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const saveCabinBtn = document.getElementById('saveCabinBtn');

  // Поля формы
  const cabinIdField = document.getElementById('cabinId');
  const nameField = document.getElementById('cabinName');
  const descField = document.getElementById('cabinDescription');
  const capacityField = document.getElementById('cabinCapacity');
  const priceField = document.getElementById('cabinBasePrice');
  const statusField = document.getElementById('cabinStatus');
  const allowPetsField = document.getElementById('cabinAllowPets');
const petDogField = document.getElementById('cabinPetDog');
const petCatField = document.getElementById('cabinPetCat');
const petPriceField = document.getElementById('cabinPetPrice');
const petPriceTypeField = document.getElementById('cabinPetPriceType');
const baseGuestsField = document.getElementById('cabinBaseGuests');
const extraGuestPriceField = document.getElementById('cabinExtraGuestPrice');

  if(allowPetsField) {
    allowPetsField.addEventListener('change', (e) => {
      const petOptions = document.getElementById('admin-pet-options');
      if(petOptions) petOptions.style.display = e.target.checked ? 'block' : 'none';
    });
  }
  const externalCalendarList = document.getElementById('externalCalendarList');
  const addExternalCalendarBtn = document.getElementById('addExternalCalendarBtn');
  const syncExternalCalendarsBtn = document.getElementById('syncExternalCalendarsBtn');
  const externalCalendarStatus = document.getElementById('externalCalendarStatus');

  let currentCabins = [];
  let currentCabinImages = [];
  const pendingUploadPaths = new Set();
  let globalAmenities = {};
  let globalExtraServices = [];
  let globalTags = [];
  let globalCabinTags = {};
  let currentExternalCalendars = [];
  let currentCustomCategories = [];

  // Загрузка списка домиков
  async function loadCabins() {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted);">Загрузка...</td></tr>';
    try {
      const data = await EcoApi.get('/api/admin/cabins');
      if (!data) throw new Error('Ошибка загрузки (возможно, требуется авторизация)');
      
      const amenitiesData = await EcoApi.get('/api/admin/amenities');
      if (amenitiesData) {
        globalAmenities = amenitiesData;
      }
      
      const settingsData = await EcoApi.get('/api/admin/settings');
      if (settingsData && settingsData.fundName) {
        const input = document.getElementById('fundNameInput');
        if (input) input.value = settingsData.fundName;
      }

      const houseItemsData = await EcoApi.get('/api/admin/house-items');
      if (houseItemsData) {
        globalExtraServices = houseItemsData;

        // Рендерим чекбоксы наполнения домика (только активные)
        const grid = document.getElementById('cabinAmenitiesGrid');
        const activeItems = globalExtraServices.filter(item => item.is_active !== false);
        const grouped = {};
        activeItems.forEach(item => {
          let cat = item.category;
          if (!cat) {
            const lower = item.name.toLowerCase();
            if (/кровать|диван|террас|кресл|зона/i.test(lower)) cat = 'Зона отдыха';
            else if (/саун|бан|душ|ванн/i.test(lower)) cat = 'Тепло и забота';
            else cat = 'Бытовые удобства';
          }
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        });

        grid.innerHTML = Object.keys(grouped).map(catName => `
          <div style="width: 100%; margin-top: 6px; margin-bottom: 4px;">
            <div style="color: var(--gold); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px;">
              ${escapeAttr(catName)}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${grouped[catName].map(item => `
                <label style="display: flex; align-items: center; gap: 6px; background: rgba(var(--cream-rgb), 0.04); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line); font-size: 13px;">
                  <input type="checkbox" value="${escapeAttr(item.name)}">
                  ${item.icon ? `<i data-lucide="${escapeAttr(item.icon)}" style="width: 16px; height: 16px; color: var(--gold);"></i>` : ''}
                  ${escapeAttr(item.name)}
                </label>
              `).join('')}
            </div>
          </div>
        `).join('');
          
        if (window.lucide) {
          setTimeout(() => window.lucide.createIcons({ root: grid }), 0);
        }
      }

      const tagsList = await EcoApi.get('/api/admin/tags');
      if (tagsList) globalTags = tagsList;

      const cabinTagsData = await EcoApi.get('/api/admin/cabin-tags');
      if (cabinTagsData) globalCabinTags = cabinTagsData;

      // Рендерим чекбоксы тегов
      const tagsGrid = document.getElementById('cabinTagsGrid');
      if (tagsGrid) {
        tagsGrid.innerHTML = globalTags.map(tag => 
          `<label><input type="checkbox" value="${escapeAttr(tag)}"> ${escapeAttr(tag)}</label>`
        ).join('');
      }
      
      currentCabins = data;
      renderCabins(currentCabins);
    } catch (e) {
      console.error(e);
      if (window.showToast) window.showToast('Ошибка загрузки объектов', 'error');
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ff8c8c;">Ошибка загрузки (попробуйте обновить страницу)</td></tr>';
    }
  }

  // Отрисовка таблицы
  function renderCabins(cabins) {
    if (cabins.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted);">Объекты не найдены</td></tr>';
      return;
    }

    tableBody.innerHTML = cabins.map(c => {
      const mainImg = (c.images && c.images.length > 0) 
        ? c.images.find(img => img.category === 'main') || c.images[0] 
        : { url: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80' };

      return `
      <tr>
        <td data-label="Фото">
          <div class="cabin-avatar" data-image-url="${escapeAttr(mainImg.url)}" style="width: 40px; height: 40px; border-radius: 4px; background-size: cover;"></div>
        </td>
        <td data-label="Название" style="font-weight: 600;">${escapeAttr(c.name)}${(c.external_calendars && c.external_calendars.length) ? `<div style="color:var(--muted); font-size:12px; font-weight:500; margin-top:4px;">iCal: ${c.external_calendars.map(src => escapeAttr(src.source_name)).join(', ')}</div>` : ''}</td>
        <td data-label="Вместимость">до ${c.capacity || 0} гостей</td>
        <td data-label="Цена">${(c.base_price || 0).toLocaleString('ru-RU')} ₽</td>
        <td data-label="Статус">
          <span style="color: ${c.status === 'active' ? 'var(--moss-2)' : c.status === 'maintenance' ? 'var(--gold)' : 'var(--muted)'};">
            ${c.status === 'active' ? 'Активен' : c.status === 'maintenance' ? 'Обслуживание' : 'Скрыт'}
          </span>
        </td>
        <td data-label="Действие">
          <button class="btn btn-ghost edit-btn" data-id="${c.id}" style="padding: 4px 12px; min-height: 28px;">Редакт.</button>
        </td>
      </tr>
    `}).join('');

    tableBody.querySelectorAll('.cabin-avatar[data-image-url]').forEach((element) => {
      element.style.backgroundImage = `url("${element.dataset.imageUrl.replace(/["\\\n\r]/g, '')}")`;
    });

    // Обработчики кнопок редактирования
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openEditModal(id);
      });
    });
  }

  const addCabinBtn = document.getElementById('addCabinBtn');
  const deleteCabinBtn = document.getElementById('deleteCabinBtn');
  
  const saveFundNameBtn = document.getElementById('saveFundNameBtn');
  if (saveFundNameBtn) {
    saveFundNameBtn.addEventListener('click', async () => {
      const fundName = document.getElementById('fundNameInput').value;
      const btn = saveFundNameBtn;
      btn.textContent = '...';
      btn.disabled = true;
      try {
        const currentSettings = await EcoApi.get('/api/admin/settings') || {};
        currentSettings.fundName = fundName;
        await EcoApi.post('/api/admin/settings', currentSettings);
        if (window.showToast) window.showToast('Название фонда сохранено', 'success');
        if (window.clearDirty) window.clearDirty();
      } catch (e) {
        if (window.showToast) window.showToast('Ошибка при сохранении', 'error');
      } finally {
        btn.textContent = 'Сохранить';
        btn.disabled = false;
      }
    });
  }

  // Переключение вкладок модального окна
  const modalTabsNav = document.getElementById('modalTabsNav');
  if (modalTabsNav) {
    modalTabsNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.modal-tab-btn');
      if (!btn) return;
      const targetTab = btn.dataset.tab;
      document.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');
    });
  }

  function resetModalTabs() {
    document.querySelectorAll('.modal-tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    document.querySelectorAll('.tab-pane').forEach((p, i) => p.classList.toggle('active', i === 0));
  }

  function syncFlatAmenitiesGrid() {
    const allSelected = new Set();
    currentCustomCategories.forEach(cat => {
      (cat.items || []).forEach(name => allSelected.add(name));
    });
    const grid = document.getElementById('cabinAmenitiesGrid');
    if (!grid) return;
    grid.innerHTML = Array.from(allSelected).map(name => `
      <input type="checkbox" value="${escapeAttr(name)}" checked style="display:none;">
    `).join('');
  }

  function renderCustomCategories() {
    const container = document.getElementById('customCategoriesContainer');
    if (!container) return;

    const activeHouseItems = (globalExtraServices || []).filter(item => item.is_active !== false);

    if (currentCustomCategories.length === 0) {
      container.innerHTML = '<div style="color:var(--muted); font-size:13px; padding:12px; border:1px dashed var(--line); border-radius:8px; text-align:center;">Категории ещё не созданы. Нажмите «+ Добавить категорию» выше.</div>';
      syncFlatAmenitiesGrid();
      return;
    }

    container.innerHTML = currentCustomCategories.map((cat, catIndex) => {
      const currentIcon = cat.icon || 'sparkles';
      return `
        <div class="custom-cat-card" data-cat-index="${catIndex}" style="background: rgba(var(--cream-rgb), 0.03); border: 1px solid var(--line); border-radius: 12px; padding: 16px;">
          <div style="display: flex; gap: 12px; align-items: flex-end; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap;">
            
            <!-- Нарисованная иконка категории (превью) -->
            <div>
              <label style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px;">Иконка</label>
              <div class="cat-icon-preview" data-cat-index="${catIndex}" style="width: 38px; height: 38px; border-radius: 8px; background: rgba(197, 170, 103, 0.15); border: 1px solid var(--gold); display: flex; align-items: center; justify-content: center; color: var(--gold); flex-shrink: 0; box-sizing: border-box;">
                <i data-lucide="${escapeAttr(currentIcon)}" style="width: 20px; height: 20px;"></i>
              </div>
            </div>

            <!-- Выбор иконки категории -->
            <div style="flex: 0 1 220px; min-width: 170px;">
              <label style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px;">Иконка категории:</label>
              <select class="cat-icon-select" data-cat-index="${catIndex}" style="height: 38px; padding: 0 10px; border-radius: 8px; background: rgba(var(--cream-rgb), 0.05); border: 1px solid var(--line); color: var(--cream); font-size: 12px; width: 100%; box-sizing: border-box;">
                ${POPULAR_HIGHLIGHT_ICONS.map(ic => `
                  <option value="${ic.id}" ${currentIcon === ic.id ? 'selected' : ''}>${ic.label} (${ic.id})</option>
                `).join('')}
              </select>
            </div>

            <!-- Название категории -->
            <div style="flex: 1 1 240px; min-width: 200px;">
              <label style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px;">Название категории:</label>
              <input type="text" class="custom-cat-name-input" value="${escapeAttr(cat.name || '')}" placeholder="Пример: Зона отдыха / Тепло и забота / Бытовые удобства" style="height: 38px; background: rgba(var(--cream-rgb), 0.05); border: 1px solid var(--line); color: var(--cream); padding: 0 12px; border-radius: 8px; font-size: 13px; width: 100%; box-sizing: border-box;">
            </div>

            <!-- Кнопка удаления категории -->
            <div>
              <button type="button" class="btn btn-ghost delete-cat-btn" style="height: 38px; padding: 0 14px; font-size: 12px; border-color: #8b3c3c; color: #ff8c8c; border-radius: 8px; white-space: nowrap;">Удалить категорию</button>
            </div>
          </div>

          <div style="font-size: 11px; color: var(--muted); margin-bottom: 8px;">Отметьте удобства, входящие в эту категорию:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${activeHouseItems.map(item => {
              const checked = Array.isArray(cat.items) && cat.items.includes(item.name);
              return `
                <label style="display: flex; align-items: center; gap: 6px; background: rgba(var(--cream-rgb), 0.03); padding: 6px 12px; border-radius: 8px; border: 1px solid ${checked ? 'var(--gold)' : 'var(--line)'}; font-size: 13px; cursor: pointer; transition: all 0.15s ease;">
                  <input type="checkbox" class="cat-item-checkbox" value="${escapeAttr(item.name)}" ${checked ? 'checked' : ''} style="accent-color: var(--gold);">
                  ${item.icon ? `<i data-lucide="${escapeAttr(item.icon)}" style="width: 15px; height: 15px; color: var(--gold);"></i>` : ''}
                  <span style="color: ${checked ? 'var(--cream)' : 'var(--muted)'};">${escapeAttr(item.name)}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) {
      window.lucide.createIcons({ root: container, nameAttr: 'data-lucide' });
    }

    container.querySelectorAll('.cat-icon-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.catIndex, 10);
        if (currentCustomCategories[idx]) {
          currentCustomCategories[idx].icon = e.target.value;
          const preview = container.querySelector(`.cat-icon-preview[data-cat-index="${idx}"]`);
          if (preview) {
            preview.innerHTML = `<i data-lucide="${escapeAttr(e.target.value)}" style="width: 20px; height: 20px;"></i>`;
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
              window.lucide.createIcons({ root: preview });
            }
          }
          checkChanges();
        }
      });
    });

    container.querySelectorAll('.custom-cat-name-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.custom-cat-card');
        const idx = parseInt(card.dataset.catIndex, 10);
        if (currentCustomCategories[idx]) {
          currentCustomCategories[idx].name = e.target.value.trim();
          checkChanges();
        }
      });
    });

    container.querySelectorAll('.delete-cat-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.custom-cat-card');
        const idx = parseInt(card.dataset.catIndex, 10);
        currentCustomCategories.splice(idx, 1);
        renderCustomCategories();
        checkChanges();
      });
    });

    container.querySelectorAll('.cat-item-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const card = e.target.closest('.custom-cat-card');
        const idx = parseInt(card.dataset.catIndex, 10);
        const itemName = e.target.value;
        if (!currentCustomCategories[idx].items) currentCustomCategories[idx].items = [];
        if (e.target.checked) {
          if (!currentCustomCategories[idx].items.includes(itemName)) {
            currentCustomCategories[idx].items.push(itemName);
          }
        } else {
          currentCustomCategories[idx].items = currentCustomCategories[idx].items.filter(name => name !== itemName);
        }
        syncFlatAmenitiesGrid();
        renderCustomCategories();
        checkChanges();
      });
    });

    syncFlatAmenitiesGrid();
  }

  const addCustomCategoryBtn = document.getElementById('addCustomCategoryBtn');
  if (addCustomCategoryBtn) {
    addCustomCategoryBtn.addEventListener('click', () => {
      currentCustomCategories.push({
        id: 'cat_' + Date.now().toString(36),
        name: '',
        icon: 'sparkles',
        items: []
      });
      renderCustomCategories();
      checkChanges();
    });
  }

  function initializeCustomCategoriesForCabin(cabin) {
    const addons = cabin.addons || {};

    if (Array.isArray(addons.categories) && addons.categories.length > 0) {
      currentCustomCategories = JSON.parse(JSON.stringify(addons.categories)).map(cat => ({
        id: cat.id || 'cat_' + Date.now().toString(36),
        name: cat.name || '',
        icon: cat.icon || 'sparkles',
        items: Array.isArray(cat.items) ? cat.items : []
      }));
    } else {
      currentCustomCategories = [];
    }

    renderCustomCategories();
  }

  const POPULAR_HIGHLIGHT_ICONS = [
    { id: 'users', label: 'Гости / Вместимость' },
    { id: 'flame', label: 'Сауна / Баня / Огонь' },
    { id: 'home', label: 'Дом / Беседка' },
    { id: 'waves', label: 'Вода / Озеро / Бассейн' },
    { id: 'bed-double', label: 'Кровать' },
    { id: 'sofa', label: 'Диван / Зона отдыха' },
    { id: 'bath', label: 'Ванна / Джакузи' },
    { id: 'shower-head', label: 'Душ' },
    { id: 'sparkles', label: 'Комфорт / Уют' },
    { id: 'trees', label: 'Лес / Природа' },
    { id: 'mountain', label: 'Горы / Панорама' },
    { id: 'utensils', label: 'Кухня / BBQ' },
    { id: 'coffee', label: 'Кофе / Чай' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'tv', label: 'Телевизор' },
    { id: 'sun', label: 'Солнце / Терраса' },
    { id: 'footprints', label: 'Пешие прогулки / Тропа' },
    { id: 'map-pin', label: 'Метка / Локация' },
    { id: 'compass', label: 'Центр / Ориентир' },
    { id: 'heart', label: 'Романтика / Любимое' },
    { id: 'star', label: 'Премиум' },
    { id: 'snowflake', label: 'Кондиционер' },
    { id: 'wind', label: 'Свежий воздух' }
  ];

  function updateIconPreview(selectEl) {
    if (!selectEl) return;
    const previewId = selectEl.dataset.preview;
    const previewEl = document.getElementById(previewId);
    if (!previewEl) return;
    const iconName = selectEl.value || 'star';
    previewEl.innerHTML = `<i data-lucide="${escapeAttr(iconName)}" style="width: 18px; height: 18px; color: var(--gold);"></i>`;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: previewEl });
    }
  }

  function setupIconSelect(selectId, defaultIcon) {
    const el = document.getElementById(selectId);
    if (!el) return;
    if (el.options.length === 0) {
      el.innerHTML = POPULAR_HIGHLIGHT_ICONS.map(item => 
        `<option value="${item.id}">${item.label} (${item.id})</option>`
      ).join('');
    }
    if (defaultIcon) el.value = defaultIcon;
    updateIconPreview(el);
  }

  // Навешиваем слушатели на все селекторы иконок
  document.querySelectorAll('.icon-select').forEach(sel => {
    sel.addEventListener('change', () => {
      updateIconPreview(sel);
      checkChanges();
    });
  });

  function populateAddonFields(addons = {}, cabin = {}) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    // Обновляем надзаголовок первого экрана (кикер)
    const kickerEl = document.getElementById('heroKickerPreview');
    if (kickerEl) {
      kickerEl.textContent = `— ${(cabin.name || 'ОБЪЕКТ').toUpperCase()} · АРЕНДА`;
    }

    setVal('addonHeroTitle', addons.hero_title);
    setVal('addonHeroSubtitle', addons.hero_subtitle);
    setVal('addonHeroBtn', addons.hero_btn);

    setVal('addonAboutTitle', addons.about_title);
    setVal('addonAboutDesc', addons.about_desc);
    
    setupIconSelect('addonBadgeIcon', addons.badge_icon || 'map-pin');
    setVal('addonBadgeText', addons.badge_text);

    setupIconSelect('addonHighlight1Icon', addons.highlight_1?.icon || 'users');
    setVal('addonHighlight1Title', addons.highlight_1?.title);
    setVal('addonHighlight1Sub', addons.highlight_1?.sub);

    setupIconSelect('addonHighlight2Icon', addons.highlight_2?.icon || 'flame');
    setVal('addonHighlight2Title', addons.highlight_2?.title);
    setVal('addonHighlight2Sub', addons.highlight_2?.sub);

    setupIconSelect('addonHighlight3Icon', addons.highlight_3?.icon || 'home');
    setVal('addonHighlight3Title', addons.highlight_3?.title);
    setVal('addonHighlight3Sub', addons.highlight_3?.sub);
  }

  function collectAddonData() {
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    return {
      hero_title: getVal('addonHeroTitle'),
      hero_subtitle: getVal('addonHeroSubtitle'),
      hero_btn: getVal('addonHeroBtn'),
      about_title: getVal('addonAboutTitle'),
      about_desc: getVal('addonAboutDesc'),
      badge_icon: document.getElementById('addonBadgeIcon')?.value || 'map-pin',
      badge_text: getVal('addonBadgeText'),
      highlight_1: {
        title: getVal('addonHighlight1Title'),
        sub: getVal('addonHighlight1Sub'),
        icon: document.getElementById('addonHighlight1Icon')?.value || 'users'
      },
      highlight_2: {
        title: getVal('addonHighlight2Title'),
        sub: getVal('addonHighlight2Sub'),
        icon: document.getElementById('addonHighlight2Icon')?.value || 'flame'
      },
      highlight_3: {
        title: getVal('addonHighlight3Title'),
        sub: getVal('addonHighlight3Sub'),
        icon: document.getElementById('addonHighlight3Icon')?.value || 'home'
      },
      categories: currentCustomCategories
    };
  }

  // Открытие модалки (для нового или существующего)
  function openEditModal(id = null) {
    resetModalTabs();
    if (id) {
      const c = currentCabins.find(cabin => cabin.id === id);
      if (!c) return;
  
      document.getElementById('modalTitle').textContent = 'Редактирование объекта';
      cabinIdField.value = c.id;
      nameField.value = c.name;
      descField.value = c.description || '';
      capacityField.value = c.capacity;
      priceField.value = c.base_price;
      statusField.value = c.status;
      allowPetsField.checked = c.allow_pets || false;
      if(petDogField) petDogField.checked = Array.isArray(c.allowed_pet_types) && c.allowed_pet_types.includes('dog');
      if(petCatField) petCatField.checked = Array.isArray(c.allowed_pet_types) && c.allowed_pet_types.includes('cat');
      if(petPriceField) petPriceField.value = c.pet_price || '';
      if(petPriceTypeField) petPriceTypeField.value = c.pet_price_type || 'per_night';
      if(baseGuestsField) baseGuestsField.value = c.base_guests || c.capacity || '';
      if(extraGuestPriceField) extraGuestPriceField.value = c.extra_guest_price || '';
      const petOptions = document.getElementById('admin-pet-options');
      if(petOptions) petOptions.style.display = c.allow_pets ? 'block' : 'none';
      currentCabinImages = JSON.parse(JSON.stringify(c.images || []));
      currentExternalCalendars = JSON.parse(JSON.stringify(c.external_calendars || []));
      deleteCabinBtn.style.display = 'block';

      // Устанавливаем чекбоксы наполнения
      const cabinAmenities = globalAmenities[c.id] || (Array.isArray(c.amenities) ? c.amenities : []);
      document.querySelectorAll('#cabinAmenitiesGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = cabinAmenities.includes(cb.value);
      });

      // Устанавливаем чекбоксы тегов
      const cabinTags = globalCabinTags[c.id] || (Array.isArray(c.tags) ? c.tags : []);
      document.querySelectorAll('#cabinTagsGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = cabinTags.includes(cb.value);
      });

      // Инициализируем категории и тексты дополнений
      initializeCustomCategoriesForCabin(c);
      populateAddonFields(c.addons || {}, c);

      // Формируем ссылку на iCal
      const exportLink = `${window.location.origin}/api/ical/export/${c.slug || c.id}.ics`;
      const exportLinkBox = document.getElementById('cabinExportLink');
      exportLinkBox.value = exportLink;
      exportLinkBox.style.color = '#8bc48b'; // Обычный цвет
      exportLinkBox.parentElement.parentElement.style.display = 'block';

    } else {
      // Новый домик
      document.getElementById('modalTitle').textContent = 'Новый объект';
      cabinIdField.value = 'new';
      nameField.value = '';
      descField.value = '';
      capacityField.value = 2;
      priceField.value = 5000;
      statusField.value = 'active';
      allowPetsField.checked = false;
      currentCabinImages = [];
      currentExternalCalendars = [];
      deleteCabinBtn.style.display = 'none';

      // Показываем ссылку на iCal с текстом-подсказкой
      const exportLinkBox = document.getElementById('cabinExportLink');
      exportLinkBox.parentElement.parentElement.style.display = 'block';
      exportLinkBox.value = 'Ссылка появится после первого сохранения...';
      exportLinkBox.style.color = 'var(--muted)';

      // Сбрасываем чекбоксы
      document.querySelectorAll('#cabinAmenitiesGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      document.querySelectorAll('#cabinTagsGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });

      initializeCustomCategoriesForCabin({ id: 'new', amenities: [], addons: null });
      populateAddonFields({}, { name: 'НОВЫЙ ОБЪЕКТ' });
    }

    renderGallery();
    renderExternalCalendars();
    initialFormData = getFormData();
    checkChanges();

    editModal.classList.add('open'); document.body.style.overflow = 'hidden';
  }

  addCabinBtn.addEventListener('click', () => openEditModal(null));

  const copyExportLinkBtn = document.getElementById('copyExportLinkBtn');
  if (copyExportLinkBtn) {
    copyExportLinkBtn.addEventListener('click', () => {
      const linkInput = document.getElementById('cabinExportLink');
      if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
          const originalText = copyExportLinkBtn.textContent;
          copyExportLinkBtn.textContent = 'Скопировано!';
          setTimeout(() => copyExportLinkBtn.textContent = originalText, 2000);
        });
      }
    });
  }

  // Рендер галереи
  function renderGallery() {
    const mainGrid = document.getElementById('mainGalleryGrid');
    const intGrid = document.getElementById('interiorGalleryGrid');
    const extGrid = document.getElementById('exteriorGalleryGrid');
    
    // Очищаем текущие превьюшки (кроме кнопок загрузки)
    mainGrid.querySelectorAll('.gallery-item').forEach(el => el.remove());
    intGrid.querySelectorAll('.gallery-item').forEach(el => el.remove());
    extGrid.querySelectorAll('.gallery-item').forEach(el => el.remove());

    let intCount = 0;
    let extCount = 0;
    let mainBtn = mainGrid.querySelector('.gallery-upload-btn');
    mainBtn.style.display = 'flex';

    currentCabinImages.forEach((img, index) => {
      const el = document.createElement('div');
      el.className = 'gallery-item';
      el.innerHTML = `
        <img src="${escapeAttr(img.url)}" alt="Фото домика">
        <button type="button" class="remove-btn">&times;</button>
      `;
      el.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const removed = currentCabinImages.splice(index, 1)[0];
        if (removed && removed.storage_path && pendingUploadPaths.has(removed.storage_path)) {
          pendingUploadPaths.delete(removed.storage_path);
          deleteUploadedFile(removed.storage_path);
        }
        renderGallery();
        checkChanges();
      });
      if (img.category === 'main') {
        mainGrid.insertBefore(el, mainBtn);
        mainBtn.style.display = 'none'; // Только 1 главное фото
      } else if (img.category === 'interior') {
        intGrid.insertBefore(el, intGrid.querySelector('.gallery-upload-btn'));
        intCount++;
      } else if (img.category === 'exterior') {
        extGrid.insertBefore(el, extGrid.querySelector('.gallery-upload-btn'));
        extCount++;
      }
    });

    document.getElementById('interiorCount').textContent = `${intCount} / 10`;
    document.getElementById('exteriorCount').textContent = `${extCount} / 10`;
    
    intGrid.querySelector('.gallery-upload-btn').style.display = intCount >= 10 ? 'none' : 'flex';
    extGrid.querySelector('.gallery-upload-btn').style.display = extCount >= 10 ? 'none' : 'flex';
  }

  window.removeImage = function(index) {
    const removed = currentCabinImages.splice(index, 1)[0];
    if (removed && removed.storage_path && pendingUploadPaths.has(removed.storage_path)) {
      pendingUploadPaths.delete(removed.storage_path);
      deleteUploadedFile(removed.storage_path);
    }
    renderGallery();
    checkChanges();
  };

  function escapeAttr(value) {
    return EcoApi.escapeHtml(value);
  }

  async function readApiResponse(response, fallbackMessage) {
    const raw = await response.text();
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch (_error) {
      throw new Error(response.ok
        ? fallbackMessage
        : `Сервер вернул ошибку ${response.status}. Попробуйте ещё раз.`);
    }
    if (!response.ok || !payload || !payload.success) {
      throw new Error(payload?.error || `${fallbackMessage} (код ${response.status})`);
    }
    return payload;
  }

  function requestErrorMessage(error, fallbackMessage) {
    if (error instanceof TypeError && /fetch|network/i.test(String(error.message || ''))) {
      return 'Сервер не ответил. Ссылка не сохранена — проверьте соединение и повторите попытку.';
    }
    return error.message || fallbackMessage;
  }
  function renderExternalCalendars() {
    if (!externalCalendarList) return;

    if (currentExternalCalendars.length === 0) {
      externalCalendarList.innerHTML = '<div style="color:var(--muted); font-size:13px;">Источники не добавлены.</div>';
    } else {
      externalCalendarList.innerHTML = currentExternalCalendars.map((source, index) => {
        const status = source.last_sync_status === 'error'
          ? 'Ошибка: ' + (source.last_sync_error || 'не удалось синхронизировать')
          : source.last_synced_at
            ? 'Синхр.: ' + new Date(source.last_synced_at).toLocaleString('ru-RU')
            : 'Еще не синхронизирован';

        return           '<div class="external-calendar-row" data-index="' + index + '">' +
            '<input type="text" class="external-source-name" placeholder="Например: Островок / Авито / Суточно" value="' + escapeAttr(source.source_name || '') + '">' +
            '<input type="url" class="external-ical-url" placeholder="https://.../calendar.ics" value="' + escapeAttr(source.ical_url || '') + '">' +
            '<label><input type="checkbox" class="external-is-active" ' + (source.is_active === false ? '' : 'checked') + '> Активен</label>' +
            '<button type="button" class="btn btn-ghost external-remove-btn" style="min-height:34px; padding:0 10px;">Удалить</button>' +
            '<div style="grid-column:1/-1; color:var(--muted); font-size:12px;">' + escapeAttr(status) + '</div>' +
          '</div>';
      }).join('');
    }

    updateExternalCalendarStatus();
  }

  function updateExternalCalendarStatus(text, type) {
    if (!externalCalendarStatus) return;
    if (text) {
      externalCalendarStatus.textContent = text;
      externalCalendarStatus.style.color = type === 'error' ? '#ff8c8c' : type === 'success' ? 'var(--gold)' : 'var(--muted)';
      return;
    }
    const activeCount = currentExternalCalendars.filter(src => src.is_active !== false && src.ical_url).length;
    externalCalendarStatus.textContent = activeCount
      ? 'Активных iCal-источников: ' + activeCount
      : 'Поддерживаются любые сервисы с iCal: Авито, Островок, Суточно.ру, Яндекс.Путешествия, Циан и др.';
    externalCalendarStatus.style.color = 'var(--muted)';
  }

  function collectExternalCalendarsFromDom() {
    if (!externalCalendarList) return [];
    return Array.from(externalCalendarList.querySelectorAll('.external-calendar-row')).map((row) => {
      const index = parseInt(row.dataset.index, 10);
      const existing = currentExternalCalendars[index] || {};
      return {
        id: existing.id,
        source_name: row.querySelector('.external-source-name').value.trim(),
        ical_url: row.querySelector('.external-ical-url').value.trim(),
        is_active: row.querySelector('.external-is-active').checked,
      };
    }).filter(src => src.ical_url && src.ical_url.trim() !== '');
  }

  async function saveExternalCalendars(cabinId) {
    currentExternalCalendars = collectExternalCalendarsFromDom();
    const res = await fetch('/api/admin/cabins/' + encodeURIComponent(cabinId) + '/external-calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: currentExternalCalendars })
    });
    const data = await readApiResponse(res, 'Ошибка сохранения iCal');
    currentExternalCalendars = data.data || [];
    renderExternalCalendars();
    return currentExternalCalendars;
  }


  // Удаление домика
  deleteCabinBtn.addEventListener('click', async () => {
    const id = cabinIdField.value;
    if (id === 'new' || !confirm('Вы уверены, что хотите безвозвратно удалить этот объект?')) return;
    
    const originalText = deleteCabinBtn.textContent;
    deleteCabinBtn.textContent = 'Удаление...';
    deleteCabinBtn.disabled = true;
    
    try {
      const res = await fetch(`/api/admin/cabins/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      window.showToast('Домик удален', 'success');
      closeModal();
      loadCabins();
    } catch (err) {
      console.error(err);
      window.showToast('Ошибка при удалении', 'error');
    } finally {
      deleteCabinBtn.textContent = originalText;
      deleteCabinBtn.disabled = false;
    }
  });

  async function deleteUploadedFile(path) {
    try {
      await fetch('/api/admin/uploads/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
    } catch (err) {
      console.error('[admin-cabins] Не удалось очистить временное фото:', err);
    }
  }

  function cleanupPendingUploads() {
    const paths = Array.from(pendingUploadPaths);
    pendingUploadPaths.clear();
    paths.forEach(deleteUploadedFile);
  }

  // Закрытие модалки
  function closeModal() {
    cleanupPendingUploads();
    if (window.clearDirty) window.clearDirty();
    editModal.classList.remove('open'); document.body.style.overflow = '';
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  // Отслеживание изменений формы для блокировки кнопки "Сохранить"
  let initialFormData = {};
  const formInputs = [nameField, descField, capacityField, priceField, statusField, allowPetsField, petDogField, petCatField, petPriceField, petPriceTypeField, baseGuestsField, extraGuestPriceField].filter(Boolean);

  const addonInputIds = [
    'addonHeroTitle', 'addonHeroSubtitle', 'addonHeroBtn',
    'addonAboutTitle', 'addonAboutDesc', 'addonBadgeIcon', 'addonBadgeText',
    'addonHighlight1Icon', 'addonHighlight1Title', 'addonHighlight1Sub',
    'addonHighlight2Icon', 'addonHighlight2Title', 'addonHighlight2Sub',
    'addonHighlight3Icon', 'addonHighlight3Title', 'addonHighlight3Sub'
  ];
  addonInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) formInputs.push(el);
  });

  function getFormData() {
    syncFlatAmenitiesGrid();
    const selectedAmenities = Array.from(document.querySelectorAll('#cabinAmenitiesGrid input[type="checkbox"]:checked')).map(cb => cb.value);
    const selectedTags = Array.from(document.querySelectorAll('#cabinTagsGrid input[type="checkbox"]:checked')).map(cb => cb.value);
    const addonData = collectAddonData();
    return {
      name: nameField.value,
      description: descField.value,
      capacity: parseInt(capacityField.value),
      base_price: parseInt(priceField.value),
      status: statusField.value,
      allow_pets: allowPetsField ? allowPetsField.checked : false,
      allowed_pet_types: [petDogField?.checked ? 'dog' : null, petCatField?.checked ? 'cat' : null].filter(Boolean),
      pet_price: petPriceField ? parseInt(petPriceField.value)||0 : 0,
      pet_price_type: petPriceTypeField ? petPriceTypeField.value : 'per_night',
      base_guests: baseGuestsField ? parseInt(baseGuestsField.value)||parseInt(capacityField.value)||1 : 1,
      extra_guest_price: extraGuestPriceField ? parseInt(extraGuestPriceField.value)||0 : 0,
      imagesLength: currentCabinImages.length,
      imagesUrls: currentCabinImages.map(img => img.url).join(','),
      amenities: selectedAmenities.join(','),
      tags: selectedTags.join(','),
      addons: JSON.stringify(addonData),
      externalCalendars: JSON.stringify(collectExternalCalendarsFromDom().map(src => ({ id: src.id || null, source_name: src.source_name, ical_url: src.ical_url, is_active: src.is_active })))
    };
  }

  function checkChanges() {
    const current = getFormData();
    const isChanged = Object.keys(current).some(key => {
        if (Array.isArray(current[key])) return JSON.stringify(current[key]) !== JSON.stringify(initialFormData[key] || []);
        return current[key] !== initialFormData[key];
      });
    
    window.hasUnsavedChanges = isChanged;
    
    if (isChanged) {
      saveCabinBtn.disabled = false;
      saveCabinBtn.textContent = 'Сохранить';
    } else {
      saveCabinBtn.disabled = true;
      saveCabinBtn.textContent = 'Сохранить';
    }
  }

  formInputs.forEach(input => {
    input.addEventListener('input', checkChanges);
    input.addEventListener('change', checkChanges); // Для select
  });

  const amenitiesGrid = document.getElementById('cabinAmenitiesGrid');
  if (amenitiesGrid) {
    amenitiesGrid.addEventListener('change', e => {
      if (e.target.type === 'checkbox') checkChanges();
    });
  }

  const tagsGrid = document.getElementById('cabinTagsGrid');
  if (tagsGrid) {
    tagsGrid.addEventListener('change', e => {
      if (e.target.type === 'checkbox') checkChanges();
    });
  }

  if (externalCalendarList) {
    externalCalendarList.addEventListener('input', checkChanges);
    externalCalendarList.addEventListener('change', checkChanges);
    externalCalendarList.addEventListener('click', (e) => {
      const btn = e.target.closest('.external-remove-btn');
      if (!btn) return;
      const row = btn.closest('.external-calendar-row');
      const index = parseInt(row.dataset.index, 10);
      currentExternalCalendars = collectExternalCalendarsFromDom();
      currentExternalCalendars.splice(index, 1);
      renderExternalCalendars();
      checkChanges();
    });
  }

  if (addExternalCalendarBtn) {
    addExternalCalendarBtn.addEventListener('click', () => {
      currentExternalCalendars = collectExternalCalendarsFromDom();
      currentExternalCalendars.push({ source_name: '', ical_url: '', is_active: true });
      renderExternalCalendars();
      checkChanges();
    });
  }

  if (syncExternalCalendarsBtn) {
    syncExternalCalendarsBtn.addEventListener('click', async () => {
      const cabinId = cabinIdField.value;
      if (!cabinId || cabinId === 'new') {
        window.showToast('Сначала сохраните домик', 'error');
        return;
      }

      syncExternalCalendarsBtn.disabled = true;
      const originalText = syncExternalCalendarsBtn.textContent;
      syncExternalCalendarsBtn.textContent = 'Синхронизация...';
      updateExternalCalendarStatus('Сохраняю источники и запускаю синхронизацию...', 'info');

      try {
        const sources = await saveExternalCalendars(cabinId);
        let synced = 0;
        for (const source of sources.filter(src => src.is_active !== false)) {
          const res = await fetch('/api/admin/external-calendars/' + encodeURIComponent(source.id) + '/sync', { method: 'POST' });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || 'Ошибка синхронизации');
          synced += data.data.imported || 0;
        }
        const fresh = await EcoApi.get('/api/admin/cabins/' + encodeURIComponent(cabinId) + '/external-calendars');
        currentExternalCalendars = fresh || sources;
        renderExternalCalendars();
        updateExternalCalendarStatus('Синхронизировано событий: ' + synced, 'success');
        window.showToast('Внешние календари синхронизированы', 'success');
      } catch (err) {
        console.error(err);
        updateExternalCalendarStatus(err.message || 'Ошибка синхронизации', 'error');
        window.showToast(err.message || 'Ошибка синхронизации', 'error');
      } finally {
        syncExternalCalendarsBtn.disabled = false;
        syncExternalCalendarsBtn.textContent = originalText;
      }
    });
  }

  // Загрузка фото
  async function handleFileUpload(files, category) {
    if (!files || files.length === 0) return;
    
    const limit = category === 'main' ? 1 : 10;
    const currentCount = currentCabinImages.filter(img => img.category === category).length;
    if (currentCount + files.length > limit) {
      window.showToast(`Максимум ${limit} фото для этой категории`, 'error');
      return;
    }

    if (currentCabinImages.length + files.length > 20) {
      window.showToast('Всего можно загрузить не более 20 фотографий', 'error');
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('photo', file);

      window.showToast('⏳ Загрузка ' + file.name + '...', 'info');

      try {
        const res = await fetch('/api/admin/cabins/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.error);
        
        currentCabinImages.push({ url: data.url, storage_path: data.path, category, pending: true });
        if (data.path) pendingUploadPaths.add(data.path);
        renderGallery();
        checkChanges();
        
        window.showToast('Фото загружено', 'success');
      } catch (err) {
        console.error(err);
        window.showToast('Ошибка при загрузке фото', 'error');
      }
    }
  }

  document.getElementById('fileInputMain').addEventListener('change', (e) => { handleFileUpload(e.target.files, 'main'); e.target.value = ''; });
  document.getElementById('fileInputInterior').addEventListener('change', (e) => { handleFileUpload(e.target.files, 'interior'); e.target.value = ''; });
  document.getElementById('fileInputExterior').addEventListener('change', (e) => { handleFileUpload(e.target.files, 'exterior'); e.target.value = ''; });

  // Сохранение изменений
  saveCabinBtn.addEventListener('click', async () => {
    if (saveCabinBtn.disabled) return;
    const id = cabinIdField.value;
    
    const payload = getFormData();
    payload.capacity = parseInt(payload.capacity);
    payload.base_price = parseInt(payload.base_price);
    payload.images = currentCabinImages;
    payload.id = id;
    payload.selectedAmenities = payload.amenities ? payload.amenities.split(',') : [];
    payload.selectedTags = payload.tags ? payload.tags.split(',') : [];
    payload.externalCalendars = collectExternalCalendarsFromDom();
    payload.addons = collectAddonData();

    const originalText = saveCabinBtn.textContent;
    saveCabinBtn.textContent = 'Сохранение...';
    saveCabinBtn.disabled = true;

    try {
      const res = await fetch('/api/admin/cabins/save-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await readApiResponse(res, 'Ошибка сохранения объекта');

      // Файлы уже привязаны к сохраненному домику; закрытие формы не должно их удалять.
      currentCabinImages.forEach((image) => { delete image.pending; });
      pendingUploadPaths.clear();

      let savedCabinId = id;
      if (id === 'new') {
        savedCabinId = data.data.id;
        cabinIdField.value = savedCabinId; // Устанавливаем новый ID
      }
      
      currentExternalCalendars = data.data.external_calendars || payload.externalCalendars;
      globalAmenities[savedCabinId] = payload.selectedAmenities;
      globalCabinTags[savedCabinId] = payload.selectedTags;
      const foundCabin = currentCabins.find(c => c.id === savedCabinId);
      if (foundCabin) foundCabin.addons = payload.addons;

      saveCabinBtn.textContent = 'Сохранено ✓';
      saveCabinBtn.disabled = true;
      initialFormData = getFormData(); // Обновляем "исходные" данные
      
      window.showToast('Изменения сохранены', 'success');
      closeModal();
      loadCabins(); // Обновляем таблицу на фоне
    } catch (err) {
      console.error(err);
      saveCabinBtn.textContent = originalText;
      saveCabinBtn.disabled = false;
      window.showToast(requestErrorMessage(err, 'Ошибка при сохранении'), 'error');
    }
  });

  // Логаут из dashboard'а
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (!confirm('Выйти из панели управления?')) return;
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin/login';
      } catch (e) {
        console.error('Logout error:', e);
      }
    });
  }

  // Инициализация
  loadCabins();
});

