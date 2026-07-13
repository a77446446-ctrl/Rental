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
  const externalCalendarList = document.getElementById('externalCalendarList');
  const addExternalCalendarBtn = document.getElementById('addExternalCalendarBtn');
  const syncExternalCalendarsBtn = document.getElementById('syncExternalCalendarsBtn');
  const externalCalendarStatus = document.getElementById('externalCalendarStatus');

  let currentCabins = [];
  let currentCabinImages = [];
  let globalAmenities = {};
  let globalExtraServices = [];
  let globalTags = [];
  let globalCabinTags = {};
  let currentExternalCalendars = [];

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
        grid.innerHTML = globalExtraServices
          .filter(item => item.is_active !== false)
          .map(item => `
            <label style="display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" value="${item.name}">
              ${item.icon ? `<i data-lucide="${item.icon}" style="width: 16px; height: 16px; color: var(--gold);"></i>` : ''}
              ${item.name}
            </label>
          `)
          .join('');
          
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
          `<label><input type="checkbox" value="${tag}"> ${tag}</label>`
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
          <div class="cabin-avatar" style="--img: url('${mainImg.url}'); width: 40px; height: 40px; border-radius: 4px; background-size: cover;"></div>
        </td>
        <td data-label="Название" style="font-weight: 600;">${c.name}${(c.external_calendars && c.external_calendars.length) ? `<div style="color:var(--muted); font-size:12px; font-weight:500; margin-top:4px;">iCal: ${c.external_calendars.map(src => escapeAttr(src.source_name)).join(', ')}</div>` : ''}</td>
        <td data-label="Вместимость">до ${c.capacity || 0} гостей</td>
        <td data-label="Цена">${(c.base_price || 0).toLocaleString('ru-RU')} ₽</td>
        <td data-label="Статус">
          <span style="color: ${c.status === 'active' ? 'var(--moss-2)' : c.status === 'maintenance' ? 'var(--gold)' : 'var(--muted)'};">
            ${c.status === 'active' ? 'Активен' : c.status === 'maintenance' ? 'Обслуживание' : 'Скрыт'}
          </span>
        </td>
        <td data-label="Действие">
          <button class="btn btn-ghost edit-btn" data-id="${c.id}" style="padding: 4px 12px; min-height: 28px;">Редактировать</button>
        </td>
      </tr>
    `}).join('');

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
      } catch (e) {
        if (window.showToast) window.showToast('Ошибка при сохранении', 'error');
      } finally {
        btn.textContent = 'Сохранить';
        btn.disabled = false;
      }
    });
  }

  // Открытие модалки (для нового или существующего)
  function openEditModal(id = null) {
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
      currentCabinImages = JSON.parse(JSON.stringify(c.images || []));
      currentExternalCalendars = JSON.parse(JSON.stringify(c.external_calendars || []));
      deleteCabinBtn.style.display = 'block';

      // Устанавливаем чекбоксы наполнения
      const cabinAmenities = globalAmenities[c.id] || [];
      document.querySelectorAll('#cabinAmenitiesGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = cabinAmenities.includes(cb.value);
      });

      // Устанавливаем чекбоксы тегов
      const cabinTags = globalCabinTags[c.id] || [];
      document.querySelectorAll('#cabinTagsGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = cabinTags.includes(cb.value);
      });
    } else {
      // Новый домик
      document.getElementById('modalTitle').textContent = 'Новый объект';
      cabinIdField.value = 'new';
      nameField.value = '';
      descField.value = '';
      capacityField.value = 2;
      priceField.value = 5000;
      statusField.value = 'active';
      currentCabinImages = [];
      currentExternalCalendars = [];
      deleteCabinBtn.style.display = 'none';

      // Сбрасываем чекбоксы
      document.querySelectorAll('#cabinAmenitiesGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
      document.querySelectorAll('#cabinTagsGrid input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });
    }

    renderGallery();
    renderExternalCalendars();
    initialFormData = getFormData();
    checkChanges();

    editModal.classList.add('open');
  }

  addCabinBtn.addEventListener('click', () => openEditModal(null));

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
        <img src="${img.url}">
        <button type="button" class="remove-btn">&times;</button>
      `;
      el.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentCabinImages.splice(index, 1);
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
    currentCabinImages.splice(index, 1);
    renderGallery();
    checkChanges();
  };

  function escapeAttr(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
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
            '<input type="text" class="external-source-name" placeholder="Avito" value="' + escapeAttr(source.source_name || '') + '">' +
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
      : 'Avito, Суточно, Островок, Яндекс.Путешествия или другой iCal URL.';
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
    }).filter(src => src.source_name || src.ical_url);
  }

  async function saveExternalCalendars(cabinId) {
    currentExternalCalendars = collectExternalCalendarsFromDom();
    const res = await fetch('/api/admin/cabins/' + encodeURIComponent(cabinId) + '/external-calendars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: currentExternalCalendars })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Ошибка сохранения iCal');
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

  // Закрытие модалки
  function closeModal() {
    editModal.classList.remove('open');
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  // Отслеживание изменений формы для блокировки кнопки "Сохранить"
  let initialFormData = {};
  const formInputs = [nameField, descField, capacityField, priceField, statusField];

  function getFormData() {
    const selectedAmenities = Array.from(document.querySelectorAll('#cabinAmenitiesGrid input[type="checkbox"]:checked')).map(cb => cb.value);
    const selectedTags = Array.from(document.querySelectorAll('#cabinTagsGrid input[type="checkbox"]:checked')).map(cb => cb.value);
    return {
      name: nameField.value,
      description: descField.value,
      capacity: parseInt(capacityField.value),
      base_price: parseInt(priceField.value),
      status: statusField.value,
      imagesLength: currentCabinImages.length,
      imagesUrls: currentCabinImages.map(img => img.url).join(','),
      amenities: selectedAmenities.join(','),
      tags: selectedTags.join(','),
      externalCalendars: JSON.stringify(collectExternalCalendarsFromDom().map(src => ({ id: src.id || null, source_name: src.source_name, ical_url: src.ical_url, is_active: src.is_active })))
    };
  }

  function checkChanges() {
    const current = getFormData();
    const isChanged = Object.keys(current).some(key => current[key] !== initialFormData[key]);
    
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
      currentExternalCalendars.push({ source_name: 'Avito', ical_url: '', is_active: true });
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
        
        currentCabinImages.push({ url: data.url, category });
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

    const originalText = saveCabinBtn.textContent;
    saveCabinBtn.textContent = 'Сохранение...';
    saveCabinBtn.disabled = true;

    try {
      let res;
      if (id === 'new') {
        res = await fetch(`/api/admin/cabins`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`/api/admin/cabins/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      let savedCabinId = id;
      if (id === 'new') {
        savedCabinId = data.data.id;
        cabinIdField.value = savedCabinId; // Устанавливаем новый ID
      }
      
      await saveExternalCalendars(savedCabinId);

      // Сохраняем наполнение домика
      const selectedAmenities = payload.amenities ? payload.amenities.split(',') : [];
      await EcoApi.post('/api/admin/amenities', { cabinId: savedCabinId, selectedAmenities });
      globalAmenities[savedCabinId] = selectedAmenities;

      // Сохраняем теги
      const selectedTags = payload.tags ? payload.tags.split(',') : [];
      await EcoApi.post('/api/admin/cabin-tags', { cabinId: savedCabinId, selectedTags });
      globalCabinTags[savedCabinId] = selectedTags;

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
      window.showToast(err.message || 'Ошибка при сохранении', 'error');
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
