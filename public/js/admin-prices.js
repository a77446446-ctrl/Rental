/**
 * Логика управления ценами и календарем (Admin Prices)
 */

document.addEventListener('DOMContentLoaded', () => {
  const RU_HOLIDAYS = [
    '01-01','01-02','01-03','01-04','01-05','01-06','01-07','01-08',
    '02-23', '03-08', '05-01','05-09', '06-12', '11-04'
  ];

  const cabinSelector = document.getElementById('cabinSelector');
  const pricesLayout = document.getElementById('pricesLayout');
  const calendarDays = document.getElementById('calendarDays');
  const currentMonthYear = document.getElementById('currentMonthYear');
  const prevMonthBtn = document.getElementById('prevMonth');
  const nextMonthBtn = document.getElementById('nextMonth');
  
  const selectedCountEl = document.getElementById('selectedCount');
  const controlsContainer = document.getElementById('controlsContainer');
  const customPriceInput = document.getElementById('customPriceInput');
  const promoCheckbox = document.getElementById('promoCheckbox');
  const closeDatesCheckbox = document.getElementById('closeDatesCheckbox');
  const savePricesBtn = document.getElementById('savePricesBtn');
  const clearPricesBtn = document.getElementById('clearPricesBtn');

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getMoscowDate() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 3));
  }

  let currentDate = getMoscowDate(); // Текущий отображаемый месяц в МСК
  let selectedDates = new Set(); // Выбранные даты (YYYY-MM-DD)
  let customPricesData = []; // Данные о ценах для текущего домика
  let externalDatesData = []; // Даты, занятые внешними iCal-календарями

  let cabinsList = [];

  // Загрузка списка домиков
  async function loadCabins() {
    try {
      const res = await fetch('/api/admin/cabins');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      cabinsList = data.data;

      if (data.data.length === 0) {
        cabinSelector.innerHTML = '<option value="">Нет домиков</option>';
        return;
      }
      
      cabinSelector.innerHTML = '<option value="">-- Выберите домик --</option>' + 
        data.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (e) {
      console.error(e);
      window.showToast('Ошибка загрузки домиков', 'error');
    }
  }

  // Загрузка кастомных цен для выбранного домика
  async function loadPrices(cabinId) {
    if (!cabinId) return;
    try {
      const res = await fetch(`/api/admin/prices/${cabinId}?t=${Date.now()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      customPricesData = data.data || [];
      externalDatesData = data.external_dates || [];
      renderCalendar(); // Перерисовываем календарь, чтобы отобразить цены
    } catch (e) {
      console.error(e);
      window.showToast('Ошибка загрузки цен', 'error');
    }
  }

  // Смена домика
  cabinSelector.addEventListener('change', (e) => {
    const cabinId = e.target.value;
    if (cabinId) {
      pricesLayout.style.display = 'grid';
      selectedDates.clear();
      updateSelectionUI();
      loadPrices(cabinId);
    } else {
      pricesLayout.style.display = 'none';
    }
  });

  // Отрисовка календаря
  function renderCalendar() {
    calendarDays.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Форматируем заголовок (например, "Июль 2026")
    currentMonthYear.textContent = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(currentDate);
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startingDay = firstDay.getDay() - 1;
    if (startingDay < 0) startingDay = 6; // В JS воскресенье = 0, делаем понедельник = 0
    
    const totalDays = lastDay.getDate();
    
    const today = getMoscowDate();
    today.setHours(0,0,0,0);

    // Пустые ячейки до начала месяца
    for (let i = 0; i < startingDay; i++) {
      const empty = document.createElement('div');
      calendarDays.appendChild(empty);
    }

    // Дни месяца
    for (let i = 1; i <= totalDays; i++) {
      const cellDate = new Date(year, month, i);
      const dateStr = [
        year,
        String(month + 1).padStart(2, '0'),
        String(i).padStart(2, '0')
      ].join('-');

      const monthDayStr = dateStr.substring(5); // MM-DD
      const dayOfWeek = cellDate.getDay();
      
      const isSunday = dayOfWeek === 0;
      const isFriday = dayOfWeek === 5;
      const isSaturday = dayOfWeek === 6;
      const isHoliday = RU_HOLIDAYS.includes(monthDayStr);
      const isPast = cellDate < today;

      const cell = document.createElement('div');
      cell.className = 'day-cell';
      cell.dataset.date = dateStr;
      
      if (isPast) cell.classList.add('past');
      if (isSunday) cell.classList.add('sunday');
      if (isFriday) cell.classList.add('friday');
      if (isSaturday) cell.classList.add('saturday');
      if (isHoliday) cell.classList.add('holiday');
      if (selectedDates.has(dateStr)) cell.classList.add('selected');

      cell.innerHTML = `<strong>${i}</strong>`;

      // Ищем кастомные данные
      const priceData = customPricesData.find(p => p.date === dateStr);
      const externalData = externalDatesData.find(p => p.date === dateStr);
      if (externalData) {
        cell.classList.add('external');
        cell.title = 'Занято: ' + (externalData.source_name || 'Внешний календарь');
        cell.innerHTML += `<div class="external-source">${escapeHtml(externalData.source_name || 'Внешний')}</div>`;
      }
      if (priceData) {
        if (priceData.promo_description === 'CLOSED') {
          cell.innerHTML += `<div class="day-price" style="color:#d46b6b; font-size:10px; margin-top:2px;">Закрыто</div>`;
        } else if (priceData.custom_price) {
          cell.innerHTML += `<div class="day-price">${priceData.custom_price}</div>`;
        }
        if (priceData.is_promo) {
          cell.innerHTML += `<div class="day-promo">★</div>`;
        }
      }

      // Обработчик клика (только для будущих дат)
      if (!isPast && !externalData) {
        cell.addEventListener('click', () => {
          if (selectedDates.has(dateStr)) {
            selectedDates.delete(dateStr);
            cell.classList.remove('selected');
          } else {
            selectedDates.add(dateStr);
            cell.classList.add('selected');
          }
          updateSelectionUI();
        });
      }

      calendarDays.appendChild(cell);
    }
  }

  // Навигация по месяцам
  prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    selectedDates.clear();
    updateSelectionUI();
    renderCalendar();
  });
  
  nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    selectedDates.clear();
    updateSelectionUI();
    renderCalendar();
  });

  // Быстрый выбор дат
  document.getElementById('selAllMonth').addEventListener('click', () => {
    selectedDates.clear();
    document.querySelectorAll('.day-cell:not(.past):not(.external)').forEach(cell => {
      selectedDates.add(cell.dataset.date);
    });
    renderCalendar();
    updateSelectionUI();
  });

  document.getElementById('selWeekdays').addEventListener('click', () => {
    selectedDates.clear();
    document.querySelectorAll('.day-cell:not(.friday):not(.saturday):not(.holiday):not(.past):not(.external)').forEach(cell => {
      selectedDates.add(cell.dataset.date);
    });
    renderCalendar();
    updateSelectionUI();
  });

  document.getElementById('selWeekends').addEventListener('click', () => {
    selectedDates.clear();
    document.querySelectorAll('.day-cell.friday:not(.past):not(.external), .day-cell.saturday:not(.past):not(.external)').forEach(cell => {
      selectedDates.add(cell.dataset.date);
    });
    renderCalendar();
    updateSelectionUI();
  });

  document.getElementById('selHolidays').addEventListener('click', () => {
    selectedDates.clear();
    document.querySelectorAll('.day-cell.holiday:not(.past):not(.external)').forEach(cell => {
      selectedDates.add(cell.dataset.date);
    });
    renderCalendar();
    updateSelectionUI();
  });

  document.getElementById('selClear').addEventListener('click', () => {
    selectedDates.clear();
    renderCalendar();
    updateSelectionUI();
  });

  // Обновление UI при выборе дат
  function updateSelectionUI() {
    selectedCountEl.textContent = selectedDates.size;
    
    if (selectedDates.size > 0) {
      controlsContainer.style.opacity = '1';
      controlsContainer.style.pointerEvents = 'auto';
      
      // Если выбран 1 день и у него есть цена, подставим её в форму
      if (selectedDates.size === 1) {
        const dateStr = Array.from(selectedDates)[0];
        const priceData = customPricesData.find(p => p.date === dateStr);
        if (priceData) {
          customPriceInput.value = priceData.custom_price || '';
          promoCheckbox.checked = priceData.is_promo;
          closeDatesCheckbox.checked = (priceData.promo_description === 'CLOSED');
          document.getElementById('promoDescInput').value = (priceData.promo_description && priceData.promo_description !== 'CLOSED') ? priceData.promo_description : '';
          document.getElementById('promoDescContainer').style.display = priceData.is_promo ? 'block' : 'none';
        } else {
          customPriceInput.value = '';
          promoCheckbox.checked = false;
          closeDatesCheckbox.checked = false;
          document.getElementById('promoDescInput').value = '';
          document.getElementById('promoDescContainer').style.display = 'none';
        }
      } else {
        customPriceInput.value = '';
        promoCheckbox.checked = false;
        closeDatesCheckbox.checked = false;
        document.getElementById('promoDescInput').value = '';
        document.getElementById('promoDescContainer').style.display = 'none';
      }
    } else {
      controlsContainer.style.opacity = '0.4';
      controlsContainer.style.pointerEvents = 'none';
      customPriceInput.value = '';
      promoCheckbox.checked = false;
      closeDatesCheckbox.checked = false;
      document.getElementById('promoDescInput').value = '';
      document.getElementById('promoDescContainer').style.display = 'none';
    }
  }

  // Toggle promo desc input
  promoCheckbox.addEventListener('change', (e) => {
    document.getElementById('promoDescContainer').style.display = e.target.checked ? 'block' : 'none';
  });

  // Сохранение настроек
  savePricesBtn.addEventListener('click', async () => {
    const cabin_id = cabinSelector.value;
    const dates = Array.from(selectedDates);
    if (!cabin_id || dates.length === 0) return;

    // Определяем какую цену отправлять
    let finalPrice = customPriceInput.value ? parseInt(customPriceInput.value) : null;
    
    if (!finalPrice) {
      const cabin = cabinsList.find(c => c.id === cabin_id);
      if (cabin) {
        finalPrice = cabin.base_price;
      }
    }

    const originalText = savePricesBtn.textContent;
    savePricesBtn.textContent = 'Сохранение...';
    savePricesBtn.disabled = true;

    try {
      const payload = {
        cabin_id,
        dates,
        custom_price: finalPrice,
        is_promo: promoCheckbox.checked,
        is_closed: closeDatesCheckbox.checked,
        promo_description: document.getElementById('promoDescInput').value || null
      };

      const res = await fetch('/api/admin/prices/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      window.showToast('Цены обновлены', 'success');
      
      // Снимаем выделение и перезагружаем цены
      selectedDates.clear();
      updateSelectionUI();
      await loadPrices(cabin_id);
      
      // Визуальный отклик кнопки
      savePricesBtn.textContent = 'Сохранено!';
      setTimeout(() => {
        savePricesBtn.textContent = originalText;
        savePricesBtn.disabled = false;
      }, 2000);
      
    } catch (e) {
      console.error(e);
      window.showToast(e.message || 'Ошибка при сохранении', 'error');
      savePricesBtn.textContent = originalText;
      savePricesBtn.disabled = false;
    }
  });

  // Сброс настроек
  clearPricesBtn.addEventListener('click', async () => {
    const cabin_id = cabinSelector.value;
    const dates = Array.from(selectedDates);
    if (!cabin_id || dates.length === 0) return;

    if (!confirm(`Вы уверены, что хотите сбросить кастомные настройки для ${dates.length} дней?`)) return;

    const originalText = clearPricesBtn.textContent;
    clearPricesBtn.textContent = 'Удаление...';
    clearPricesBtn.disabled = true;

    try {
      const payload = { cabin_id, dates, remove: true };

      const res = await fetch('/api/admin/prices/bulk-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      window.showToast('Настройки сброшены', 'success');
      
      selectedDates.clear();
      updateSelectionUI();
      await loadPrices(cabin_id);
    } catch (e) {
      console.error(e);
      window.showToast('Ошибка при сбросе', 'error');
    } finally {
      clearPricesBtn.textContent = originalText;
      clearPricesBtn.disabled = false;
    }
  });

  // Логаут
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
  
  // Рисуем первоначальный пустой календарь
  renderCalendar();
});
