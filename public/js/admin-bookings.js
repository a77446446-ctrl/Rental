/**
 * Логика управления бронированиями (Admin Bookings)
 */

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('bookingsTableBody');

  async function loadBookings() {
    try {
      const res = await fetch('/api/admin/bookings');
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error);

      if (data.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--muted); padding:32px;">Нет бронирований</td></tr>';
        return;
      }

      tableBody.innerHTML = data.data.map(b => {
        const createdDate = new Date(b.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const shortId = b.id.split('-')[0].toUpperCase();
        
        let statusBadge = '';
        if (b.status === 'pending') statusBadge = '<span class="status-badge status-pending">Ожидает</span>';
        else if (b.status === 'confirmed') statusBadge = '<span class="status-badge status-confirmed">Подтверждена</span>';
        else if (b.status === 'cancelled') statusBadge = '<span class="status-badge status-cancelled">Отменена</span>';

        return `
          <tr>
            <td>
              <div style="font-weight:600;">#${shortId}</div>
              <small style="color:var(--muted); font-size:11px;">${createdDate}</small>
            </td>
            <td>
              <div class="guest-info">
                <strong>${b.guest_name}</strong>
                <small>${b.guest_phone}</small>
                ${b.guest_telegram ? `<small>@${b.guest_telegram.replace('@', '')}</small>` : ''}
              </div>
            </td>
            <td>${b.cabins ? b.cabins.name : 'Удаленный домик'}</td>
            <td style="white-space:nowrap;">
              ${b.check_in} &rarr; ${b.check_out}
            </td>
            <td style="font-weight:600; color:var(--gold);">${EcoApi.formatPrice(b.total_price)}</td>
            <td>${statusBadge}</td>
            <td>
              <select class="action-select status-select" data-id="${b.id}">
                <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>Ожидает</option>
                <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Подтвердить</option>
                <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Отменить</option>
              </select>
            </td>
          </tr>
        `;
      }).join('');

      // Привязываем слушатели изменения статуса
      document.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const id = e.target.dataset.id;
          const newStatus = e.target.value;
          
          if (newStatus === 'cancelled') {
            if (!confirm('Отменить эту бронь? Это освободит даты в календаре.')) {
              // Возвращаем как было
              loadBookings();
              return;
            }
          }

          e.target.disabled = true;
          try {
            const res = await fetch(`/api/admin/bookings/${id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            window.showToast('Статус обновлен', 'success');
            loadBookings();
          } catch (err) {
            console.error(err);
            window.showToast('Ошибка при обновлении', 'error');
            loadBookings();
          }
        });
      });

    } catch (err) {
      console.error(err);
      tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#e57373; padding:32px;">Ошибка загрузки</td></tr>';
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

  loadBookings();

  // Автообновление: опрос новых бронирований каждые 10 секунд
  let lastBookingsCount = 0;
  let lastPendingCount = 0;

  async function pollBookings() {
    try {
      const res = await fetch('/api/admin/bookings');
      const data = await res.json();
      if (!data.success) return;

      const newCount = data.data.length;
      const newPending = data.data.filter(b => b.status === 'pending').length;

      // Если количество бронирований изменилось — перезагружаем таблицу
      if (newCount !== lastBookingsCount || newPending !== lastPendingCount) {
        lastBookingsCount = newCount;

        // Если появились новые pending-бронирования — уведомляем
        if (newPending > lastPendingCount && lastPendingCount > 0) {
          if (window.showToast) window.showToast('Новая заявка на бронирование!', 'success');
        }
        lastPendingCount = newPending;

        // Перезагружаем таблицу, но не ломаем текущее взаимодействие
        // (не перезагружаем, если пользователь в данный момент меняет select)
        if (!document.activeElement || !document.activeElement.classList.contains('status-select')) {
          loadBookings();
        }

        // Визуальное уведомление во вкладке
        if (newPending > 0 && document.hidden) {
          document.title = '(' + newPending + ') Бронирования | EcoGorniy Admin';
        }
      }
    } catch (err) {
      // Игнорируем ошибки polling
    }
  }

  setInterval(pollBookings, 10000);

  // Восстанавливаем заголовок при возвращении на вкладку
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      document.title = 'Бронирования | EcoGorniy Admin';
    }
  });
});
