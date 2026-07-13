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
      { label: 'Активные брони', value: formatNumber(summary.active_bookings), note: 'Ожидают, подтверждены, завершены' },
      { label: 'Ночей', value: formatNumber(summary.active_nights), note: 'По активным броням' },
      { label: 'Гостей в бронях', value: formatNumber(summary.guests_count), note: 'Уникальных клиентов: ' + formatNumber(summary.unique_guests) },
    ];

    metricsGrid.innerHTML = cards.map((card) => (
      '<article class="metric-card">' +
        '<div class="metric-label">' + escapeHtml(card.label) + '</div>' +
        '<div>' +
          '<div class="metric-value">' + escapeHtml(card.value) + '</div>' +
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
      '<table>' +
        '<thead><tr><th>Статус</th><th>Брони</th><th>Сумма</th><th>Ночи</th></tr></thead>' +
        '<tbody>' +
          items.map((item) => (
            '<tr>' +
              '<td>' + escapeHtml(item.label) + '</td>' +
              '<td>' + formatNumber(item.bookings) + '</td>' +
              '<td class="money">' + formatPrice(item.revenue) + '</td>' +
              '<td>' + formatNumber(item.nights) + '</td>' +
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
      '<table>' +
        '<thead><tr><th>Объект</th><th>Брони</th><th>Ночи</th><th>Гости</th><th>Выручка</th><th>Средний чек</th><th></th></tr></thead>' +
        '<tbody>' +
          items.map((item) => {
            const width = Math.max(4, Math.round(((item.revenue || 0) / maxRevenue) * 100));
            return (
              '<tr>' +
                '<td style="font-weight:600;">' + escapeHtml(item.cabin_name) + '</td>' +
                '<td>' + formatNumber(item.active_bookings) + ' <span class="muted">/ ' + formatNumber(item.bookings) + '</span></td>' +
                '<td>' + formatNumber(item.nights) + '</td>' +
                '<td>' + formatNumber(item.guests_count) + '</td>' +
                '<td class="money">' + formatPrice(item.revenue) + '</td>' +
                '<td>' + formatPrice(item.avg_check) + '</td>' +
                '<td><div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div></td>' +
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
      '<table>' +
        '<thead><tr><th>Месяц</th><th>Активные брони</th><th>Всего заявок</th><th>Ночи</th><th>Выручка</th></tr></thead>' +
        '<tbody>' +
          items.map((item) => (
            '<tr>' +
              '<td>' + escapeHtml(formatMonth(item.month)) + '</td>' +
              '<td>' + formatNumber(item.active_bookings) + '</td>' +
              '<td>' + formatNumber(item.bookings) + '</td>' +
              '<td>' + formatNumber(item.nights) + '</td>' +
              '<td class="money">' + formatPrice(item.revenue) + '</td>' +
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

    guestsTableWrap.innerHTML =
      '<table>' +
        '<thead><tr><th>Гость</th><th>Брони</th><th>LTV</th></tr></thead>' +
        '<tbody>' +
          items.map((item) => (
            '<tr>' +
              '<td>' +
                '<div style="font-weight:600;">' + escapeHtml(item.name) + '</div>' +
                '<small class="muted">' + escapeHtml(item.phone || item.telegram || '') + '</small>' +
              '</td>' +
              '<td>' + formatNumber(item.active_bookings) + ' <span class="muted">/ ' + formatNumber(item.bookings) + '</span></td>' +
              '<td class="money">' + formatPrice(item.ltv) + '</td>' +
            '</tr>'
          )).join('') +
        '</tbody>' +
      '</table>';
  }

  async function loadAnalytics() {
    try {
      const res = await fetch('/api/admin/analytics');
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
