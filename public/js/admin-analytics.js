/**
 * Логика раздела аналитики админ-панели.
 */

document.addEventListener('DOMContentLoaded', () => {
  const metricsGrid = document.getElementById('metricsGrid');
  const cabinsTableWrap = document.getElementById('cabinsTableWrap');
  const monthsTableWrap = document.getElementById('monthsTableWrap');
  const statusesTableWrap = document.getElementById('statusesTableWrap');
  const guestsTableWrap = document.getElementById('guestsTableWrap');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatPrice(value) {
    return window.EcoApi
      ? EcoApi.formatPrice(value || 0)
      : new Intl.NumberFormat('ru-RU').format(value || 0) + ' ₽';
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('ru-RU').format(value || 0);
  }

  function formatMonth(monthKey) {
    if (!monthKey || monthKey === 'unknown') return 'Без даты';
    const parts = monthKey.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(date);
  }

  function renderMetrics(summary) {
    const cards = [
      { label: 'Выручка активная', value: formatPrice(summary.active_revenue), note: 'Без отмененных броней' },
      { label: 'Подтверждено', value: formatPrice(summary.confirmed_revenue), note: 'Подтвержденные и завершенные' },
      { label: 'Ожидает', value: formatPrice(summary.pending_revenue), note: (summary.pending_bookings || 0) + ' заявок' },
      { label: 'Средний чек', value: formatPrice(summary.avg_check), note: 'По активным броням' },
      { label: 'Всего броней', value: formatNumber(summary.total_bookings), note: 'Включая отмененные' },
      { label: 'Активные брони', value: formatNumber(summary.active_bookings), note: 'Ожидают, подтверлены, завершены', labelClass: 'color-moss', valueClass: 'color-moss' },
      { label: 'Отмененные брони', value: formatNumber(summary.cancelled_bookings), note: 'Сумма: ' + formatPrice(summary.cancelled_revenue), labelClass: 'color-red', valueClass: 'color-red' },
      { label: 'Ночей', value: formatNumber(summary.active_nights), note: 'По активным броням' },
      { label: 'Гостей в бронях', value: formatNumber(summary.guests_count), note: 'Уникальных клиентов: ' + formatNumber(summary.unique_guests) },
    ];

    metricsGrid.innerHTML = cards.map((card) => (
      '<article class="metric-card">' +
        '<div class="metric-label ' + (card.labelClass || '') + '">' + escapeHtml(card.label) + '</div>' +
        '<div>' +
          '<div class="metric-value ' + (card.valueClass || '') + '">' + escapeHtml(card.value) + '</div>' +
          '<div class="metric-note">' + escapeHtml(card.note) + '</div>' +
        '</div>' +
      '</article>'
    )).join('');
  }

  function emptyTable(message) {
    return '<div class="empty-state">' + escapeHtml(message) + '</div>';
  }

  function renderStatuses(items) {
    if (!items || items.length === 0) {
      statusesTableWrap.innerHTML = emptyTable('Пока нет броней');
      return;
    }

    statusesTableWrap.innerHTML =
      '<table class="admin-table analytics-table">' +
        '<thead><tr><th>Статус</th><th>Брони</th><th>Сумма</th><th>Ночи</th></tr></thead>' +
        '<tbody>' +
          items.map((item) => (
            '<tr>' +
              '<td data-label="Статус" class="' + (item.status === 'cancelled' ? 'color-red' : '') + '">' + escapeHtml(item.label) + '</td>' +
              '<td data-label="Брони" class="' + (item.status === 'cancelled' ? 'color-red' : '') + '">' + formatNumber(item.bookings) + '</td>' +
              '<td data-label="Сумма" class="money ' + (item.status === 'cancelled' ? 'color-red' : '') + '">' + formatPrice(item.revenue) + '</td>' +
              '<td data-label="Ночи" class="' + (item.status === 'cancelled' ? 'color-red' : '') + '">' + formatNumber(item.nights) + '</td>' +
            '</tr>'
          )).join('') +
        '</tbody>' +
      '</table>';
  }

  function renderCabins(items) {
    if (!items || items.length === 0) {
      cabinsTableWrap.innerHTML = emptyTable('Пока нет данных по объектам');
      return;
    }

    const maxRevenue = Math.max(...items.map((item) => item.revenue || 0), 1);
    cabinsTableWrap.innerHTML =
      '<table class="admin-table analytics-table">' +
        '<thead><tr><th>Объект</th><th><span class="color-moss">Активные</span>/Всего</th><th>Ночи</th><th>Гости</th><th>Выручка</th><th>Средний чек</th><th></th></tr></thead>' +
        '<tbody>' +
          items.map((item) => {
            const width = Math.max(4, Math.round(((item.revenue || 0) / maxRevenue) * 100));
            return (
              '<tr>' +
                '<td data-label="Объект" style="font-weight:600;">' + escapeHtml(item.cabin_name) + '</td>' +
                '<td class="td-complex-label">' +
                  '<span class="mobile-complex-label"><span class="color-moss">Активные</span> / <span class="color-gold">Всего броней</span></span>' +
                  '<span><span class="color-moss" style="font-weight: 600;">' + formatNumber(item.active_bookings) + '</span> / <span class="color-gold" style="font-weight: 600;">' + formatNumber(item.bookings) + '</span></span>' +
                '</td>' +
                '<td data-label="Ночи">' + formatNumber(item.nights) + '</td>' +
                '<td data-label="Гости">' + formatNumber(item.guests_count) + '</td>' +
                '<td data-label="Выручка" class="money">' + formatPrice(item.revenue) + '</td>' +
                '<td data-label="Средний чек">' + formatPrice(item.avg_check) + '</td>' +
                '<td data-label=""><div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div></td>' +
              '</tr>'
            );
          }).join('') +
        '</tbody>' +
      '</table>';
  }

  function renderMonths(items) {
    if (!items || items.length === 0) {
      monthsTableWrap.innerHTML = emptyTable('Пока нет помесячной статистики');
      return;
    }

    monthsTableWrap.innerHTML =
      '<table class="admin-table analytics-table">' +
        '<thead><tr><th>Месяц</th><th>Активные брони</th><th>Всего заявок</th><th>Ночи</th><th>Выручка</th></tr></thead>' +
        '<tbody>' +
          items.map((item) => (
            '<tr>' +
              '<td data-label="Месяц">' + escapeHtml(formatMonth(item.month)) + '</td>' +
              '<td data-label="Активные брони"><span><span class="color-moss" style="font-weight: 600;">' + formatNumber(item.active_bookings) + '</span></span></td>' +
              '<td data-label="Всего заявок">' + formatNumber(item.bookings) + '</td>' +
              '<td data-label="Ночи">' + formatNumber(item.nights) + '</td>' +
              '<td data-label="Выручка" class="money">' + formatPrice(item.revenue) + '</td>' +
            '</tr>'
          )).join('') +
        '</tbody>' +
      '</table>';
  }

  function renderGuests(items) {
    if (!items || items.length === 0) {
      guestsTableWrap.innerHTML = emptyTable('Пока нет гостей');
      return;
    }

    const desktopTable =
      '<table class="admin-table analytics-table analytics-desktop-guests">' +
        '<thead><tr><th>Гость</th><th><span class="color-moss">Активные</span>/Всего</th><th>LTV (Выручка)</th></tr></thead>' +
        '<tbody>' +
          items.map((item) => (
            '<tr>' +
              '<td data-label="Гость">' +
                '<div style="font-weight:600;">' + escapeHtml(item.name) + '</div>' +
                '<small class="muted">' + escapeHtml(item.phone || item.telegram || '') + '</small>' +
              '</td>' +
                '<td class="td-complex-label">' +
                  '<span class="mobile-complex-label"><span class="color-moss">Активные</span> / <span class="color-gold">Всего броней</span></span>' +
                  '<span><span class="color-moss" style="font-weight: 600;">' + formatNumber(item.active_bookings) + '</span> / <span class="color-gold" style="font-weight: 600;">' + formatNumber(item.bookings) + '</span></span>' +
                '</td>' +
              '<td data-label="LTV (Выручка)" class="money">' + formatPrice(item.ltv) + '</td>' +
            '</tr>'
          )).join('') +
        '</tbody>' +
      '</table>';

    const mobileCards =
      '<div class="analytics-mobile-guests">' +
        items.map((item) => (
          '<details class="analytics-guest-card">' +
            '<summary>' +
              '<span class="analytics-guest-card-name">' + escapeHtml(item.name) + '</span>' +
              '<span class="analytics-guest-card-ltv">' + formatPrice(item.ltv) + '</span>' +
              '<span class="analytics-guest-card-phone">' + escapeHtml(item.phone || item.telegram || 'Контакт не указан') + '</span>' +
            '</summary>' +
            '<div class="analytics-guest-details">' +
              '<div class="analytics-guest-detail"><span>Активные брони</span><strong>' + formatNumber(item.active_bookings) + '</strong></div>' +
              '<div class="analytics-guest-detail"><span>Всего броней</span><strong>' + formatNumber(item.bookings) + '</strong></div>' +
              '<div class="analytics-guest-detail" style="grid-column:1/-1;"><span>LTV / выручка</span><strong>' + formatPrice(item.ltv) + '</strong></div>' +
            '</div>' +
          '</details>'
        )).join('') +
      '</div>';

    guestsTableWrap.innerHTML = desktopTable + mobileCards;
  }

  async function loadAnalytics(queryString = '') {
    try {
      const res = await fetch('/api/admin/analytics' + queryString);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Ошибка загрузки аналитики');

      renderMetrics(json.data.summary || {});
      renderStatuses(json.data.statuses || []);
      renderCabins(json.data.cabins || []);
      renderMonths(json.data.months || []);
      renderGuests(json.data.top_guests || []);
    } catch (err) {
      console.error(err);
      metricsGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1; color:#e57373;">Ошибка загрузки аналитики</div>';
      if (window.showToast) window.showToast('Ошибка загрузки аналитики', 'error');
    }
  }

  // Инструкция-аккордеон
  const analyticsInstructionsToggle = document.getElementById('analyticsInstructionsToggle');
  const analyticsInstructions = document.getElementById('analyticsInstructions');
  const analyticsInstructionsIcon = document.getElementById('analyticsInstructionsIcon');

  if (analyticsInstructionsToggle && analyticsInstructions) {
    analyticsInstructionsToggle.addEventListener('click', () => {
      if (analyticsInstructions.style.display === 'none') {
        analyticsInstructions.style.display = 'block';
        if (analyticsInstructionsIcon) analyticsInstructionsIcon.textContent = '-';
      } else {
        analyticsInstructions.style.display = 'none';
        if (analyticsInstructionsIcon) analyticsInstructionsIcon.textContent = '+';
      }
    });
  }

  // Фильтры по датам
  const periodSelect = document.getElementById('analyticsPeriod');
  const dateControlWrap = document.getElementById('dateControlWrap');
  const dateInput = document.getElementById('analyticsDate');
  const monthInput = document.getElementById('analyticsMonth');
  const btnPrev = document.getElementById('btnPrevDate');
  const btnNext = document.getElementById('btnNextDate');

  let currentPeriod = 'all';
  let currentDate = new Date();

  function updateFilterUI() {
    if (!periodSelect) return;
    currentPeriod = periodSelect.value;
    
    if (currentPeriod === 'all') {
      dateControlWrap.style.display = 'none';
    } else {
      dateControlWrap.style.display = 'flex';
      if (currentPeriod === 'day') {
        dateInput.style.display = 'block';
        monthInput.style.display = 'none';
        dateInput.value = currentDate.toISOString().split('T')[0];
      } else if (currentPeriod === 'month') {
        dateInput.style.display = 'none';
        monthInput.style.display = 'block';
        monthInput.value = currentDate.toISOString().substring(0, 7);
      }
    }
    fetchData();
  }

  function fetchData() {
    let qs = '?period=' + currentPeriod;
    if (currentPeriod === 'day') {
      qs += '&date=' + dateInput.value;
    } else if (currentPeriod === 'month') {
      qs += '&month=' + monthInput.value;
    }
    loadAnalytics(qs);
  }

  if (periodSelect) {
    periodSelect.addEventListener('change', updateFilterUI);
    
    dateInput.addEventListener('change', (e) => {
      currentDate = new Date(e.target.value);
      fetchData();
    });
    
    monthInput.addEventListener('change', (e) => {
      currentDate = new Date(e.target.value + '-01');
      fetchData();
    });

    btnPrev.addEventListener('click', () => {
      if (currentPeriod === 'day') {
        currentDate.setDate(currentDate.getDate() - 1);
        dateInput.value = currentDate.toISOString().split('T')[0];
      } else if (currentPeriod === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
        monthInput.value = currentDate.toISOString().substring(0, 7);
      }
      fetchData();
    });

    btnNext.addEventListener('click', () => {
      if (currentPeriod === 'day') {
        currentDate.setDate(currentDate.getDate() + 1);
        dateInput.value = currentDate.toISOString().split('T')[0];
      } else if (currentPeriod === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
        monthInput.value = currentDate.toISOString().substring(0, 7);
      }
      fetchData();
    });
  }

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

  loadAnalytics();
});
