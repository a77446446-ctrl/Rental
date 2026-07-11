document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('servicesTableBody');
  const editModal = document.getElementById('editModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const saveServiceBtn = document.getElementById('saveServiceBtn');

  const serviceIdField = document.getElementById('serviceId');
  const nameField = document.getElementById('serviceName');
  const descField = document.getElementById('serviceDescription');
  const priceField = document.getElementById('servicePrice');
  const priceTypeField = document.getElementById('servicePriceType');
  const statusField = document.getElementById('serviceStatus');

  const houseItemsTableBody = document.getElementById('houseItemsTableBody');
  const houseItemNameField = document.getElementById('houseItemName');
  const addHouseItemBtn = document.getElementById('addHouseItemBtn');

  let currentServices = [];
  let currentHouseItems = [];

  async function loadServices() {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted);">Загрузка...</td></tr>';
    try {
      const data = await EcoApi.get('/api/admin/extra-services');
      if (!data) throw new Error('Ошибка загрузки');
      
      currentServices = data;
      renderServices(currentServices);
    } catch (e) {
      console.error(e);
      window.showToast('Ошибка загрузки дополнительных услуг', 'error');
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ff8c8c;">Ошибка загрузки</td></tr>';
    }
  }

  function renderServices(services) {
    if (services.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted);">Услуги не найдены</td></tr>';
      return;
    }

    tableBody.innerHTML = services.map(s => {
      const priceTypeStr = s.price_type === 'per_day' ? 'За сутки' : (s.price_type === 'per_guest' ? 'За гостя' : 'За весь период');
      return `
      <tr>
        <td style="font-weight: 600;">${s.name}</td>
        <td>${(s.price || 0).toLocaleString('ru-RU')} ₽</td>
        <td>${priceTypeStr}</td>
        <td>
          <span style="color: ${s.is_active ? 'var(--moss-2)' : 'var(--muted)'};">
            ${s.is_active ? 'Активна' : 'Скрыта'}
          </span>
        </td>
        <td>
          <button class="btn btn-ghost edit-btn" data-id="${s.id}" style="padding: 4px 12px; min-height: 28px;">Редактировать</button>
        </td>
      </tr>
    `}).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openEditModal(id);
      });
    });
  }

  const addServiceBtn = document.getElementById('addServiceBtn');
  const deleteServiceBtn = document.getElementById('deleteServiceBtn');

  async function loadHouseItems() {
    if (!houseItemsTableBody) return;
    houseItemsTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--muted);">Загрузка...</td></tr>';
    try {
      const data = await EcoApi.get('/api/admin/house-items');
      currentHouseItems = Array.isArray(data) ? data : [];
      renderHouseItems();
    } catch (e) {
      console.error(e);
      houseItemsTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #ff8c8c;">Ошибка загрузки</td></tr>';
    }
  }

  function renderHouseItems() {
    if (!houseItemsTableBody) return;
    if (!currentHouseItems.length) {
      houseItemsTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--muted);">Пункты пока не добавлены</td></tr>';
      return;
    }

    houseItemsTableBody.innerHTML = currentHouseItems.map(item => `
      <tr>
        <td style="font-weight: 600;">${item.name}</td>
        <td>
          <span style="color: ${item.is_active !== false ? 'var(--moss-2)' : 'var(--muted)'};">
            ${item.is_active !== false ? 'Активен' : 'Скрыт'}
          </span>
        </td>
        <td>
          <button class="btn btn-ghost house-item-toggle" data-id="${item.id}" style="padding: 4px 10px; min-height: 28px;">${item.is_active !== false ? 'Скрыть' : 'Показать'}</button>
          <button class="btn btn-ghost house-item-delete" data-id="${item.id}" style="padding: 4px 10px; min-height: 28px; border-color: #8b3c3c; color: #ff8c8c;">Удалить</button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.house-item-toggle').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.id;
        const item = currentHouseItems.find(entry => String(entry.id) === String(id));
        if (!item) return;
        await EcoApi.patch('/api/admin/house-items/' + encodeURIComponent(id), {
          name: item.name,
          is_active: item.is_active === false,
          sort_order: item.sort_order || 0
        });
        await loadHouseItems();
      });
    });

    document.querySelectorAll('.house-item-delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.id;
        if (!confirm('Удалить этот пункт наполнения?')) return;
        await EcoApi.delete('/api/admin/house-items/' + encodeURIComponent(id));
        await loadHouseItems();
      });
    });
  }

  if (addHouseItemBtn) {
    addHouseItemBtn.addEventListener('click', async () => {
      const name = houseItemNameField.value.trim();
      if (!name) {
        window.showToast('Введите название пункта', 'error');
        return;
      }

      await EcoApi.post('/api/admin/house-items', {
        name,
        is_active: true,
        sort_order: currentHouseItems.length + 1
      });
      houseItemNameField.value = '';
      window.showToast('Пункт добавлен', 'success');
      await loadHouseItems();
    });
  }

  function openEditModal(id = null) {
    if (id) {
      const s = currentServices.find(serv => serv.id == id);
      if (!s) return;
  
      document.getElementById('modalTitle').textContent = 'Редактирование услуги';
      serviceIdField.value = s.id;
      nameField.value = s.name;
      descField.value = s.description || '';
      priceField.value = s.price;
      priceTypeField.value = s.price_type || 'per_stay';
      statusField.value = s.is_active ? 'active' : 'inactive';
      deleteServiceBtn.style.display = 'block';
    } else {
      document.getElementById('modalTitle').textContent = 'Новая услуга';
      serviceIdField.value = 'new';
      nameField.value = '';
      descField.value = '';
      priceField.value = 0;
      priceTypeField.value = 'per_stay';
      statusField.value = 'active';
      deleteServiceBtn.style.display = 'none';
    }

    editModal.classList.add('open');
  }

  addServiceBtn.addEventListener('click', () => openEditModal(null));

  deleteServiceBtn.addEventListener('click', async () => {
    const id = serviceIdField.value;
    if (id === 'new' || !confirm('Удалить эту услугу?')) return;
    
    const originalText = deleteServiceBtn.textContent;
    deleteServiceBtn.textContent = 'Удаление...';
    deleteServiceBtn.disabled = true;
    
    try {
      await EcoApi.delete(`/api/admin/extra-services/${id}`);
      window.showToast('Услуга удалена', 'success');
      closeModal();
      loadServices();
    } catch (err) {
      console.error(err);
      window.showToast('Ошибка при удалении', 'error');
    } finally {
      deleteServiceBtn.textContent = originalText;
      deleteServiceBtn.disabled = false;
    }
  });

  function closeModal() {
    editModal.classList.remove('open');
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelModalBtn.addEventListener('click', closeModal);

  saveServiceBtn.addEventListener('click', async () => {
    const id = serviceIdField.value;
    
    const payload = {
      name: nameField.value,
      description: descField.value,
      price: parseInt(priceField.value),
      price_type: priceTypeField.value,
      is_active: statusField.value === 'active',
      sort_order: 0
    };

    if (!payload.name) {
      window.showToast('Название обязательно', 'error');
      return;
    }

    const originalText = saveServiceBtn.textContent;
    saveServiceBtn.textContent = 'Сохранение...';
    saveServiceBtn.disabled = true;

    try {
      if (id === 'new') {
        await EcoApi.post(`/api/admin/extra-services`, payload);
      } else {
        await EcoApi.patch(`/api/admin/extra-services/${id}`, payload);
      }
      
      window.showToast('Сохранено', 'success');
      saveServiceBtn.disabled = true;
      saveServiceBtn.style.opacity = '0.5';
      
      closeModal();
      loadServices();
    } catch (err) {
      console.error(err);
      window.showToast('Ошибка сохранения', 'error');
      saveServiceBtn.disabled = false;
    } finally {
      saveServiceBtn.textContent = originalText;
    }
  });

  document.getElementById('editModal').addEventListener('input', () => {
    saveServiceBtn.disabled = false;
    saveServiceBtn.style.opacity = '1';
  });
  document.getElementById('editModal').addEventListener('change', () => {
    saveServiceBtn.disabled = false;
    saveServiceBtn.style.opacity = '1';
  });

  const originalOpenEditModal = openEditModal;
  openEditModal = function(id = null) {
    originalOpenEditModal(id);
    saveServiceBtn.disabled = true;
    saveServiceBtn.style.opacity = '0.5';
  };

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (!confirm('Выйти из панели управления?')) return;
      try {
        await EcoApi.post('/api/admin/logout');
        window.location.href = '/admin/login';
      } catch (e) {
        console.error('Logout error:', e);
      }
    });
  }

  loadServices();
  loadHouseItems();
});
