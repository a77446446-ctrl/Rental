/**
 * Логика управления бронированиями (Admin Bookings)
 */

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('bookingsTableBody');
  let globalBookingsMap = {};

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
        globalBookingsMap[b.id] = b;
        const safeGuestName = EcoApi.escapeHtml(b.guest_name);
        const safeGuestPhone = EcoApi.escapeHtml(b.guest_phone);
        const safeTelegram = EcoApi.escapeHtml(String(b.guest_telegram || '').replace('@', ''));
        const safeCabinName = EcoApi.escapeHtml(b.cabins ? b.cabins.name : 'Удаленный объект');
        
        // Проверяем, прошла ли дата выезда
        const _now = new Date();
        _now.setHours(0,0,0,0);
        const _checkOut = new Date(b.check_out + 'T00:00:00');
        const isPast = _checkOut <= _now;
        const isCompleted = isPast && b.status !== 'cancelled';

        let statusBadge = '';
        if (isCompleted) statusBadge = '<span class="status-badge" style="background:rgba(139,196,139,0.15); color:#8bc48b; border:1px solid rgba(139,196,139,0.3);">Завершена</span>';
        else if (b.status === 'pending') statusBadge = '<span class="status-badge status-pending">Ожидает</span>';
        else if (b.status === 'confirmed') statusBadge = '<span class="status-badge status-confirmed">Подтверждена</span>';
        else if (b.status === 'cancelled') statusBadge = '<span class="status-badge status-cancelled">Отменена</span>';

        return `
          <tr>
            <td data-label="ID / Дата">
              <div style="font-weight:600;">#${shortId}</div>
              <small style="color:var(--muted); font-size:11px;">${createdDate}</small>
            </td>
            <td data-label="Гость">
              <div class="guest-info">
                <strong>${safeGuestName}</strong>
                <small>${safeGuestPhone}</small>
                ${b.guest_telegram ? `<small>@${safeTelegram}</small>` : ''}
              </div>
            </td>
            <td data-label="Объект">${safeCabinName}</td>
            <td data-label="Заезд - Выезд" style="white-space:nowrap;">
              ${b.check_in} &rarr; ${b.check_out}
            </td>
            <td data-label="Сумма" style="font-weight:600; color:var(--gold);">${EcoApi.formatPrice(b.total_price)}</td>
            <td data-label="Статус">${statusBadge}</td>
            <td data-label="Действие" style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
              ${(isCompleted || b.status === 'cancelled') ? `<span style="color:var(--muted); font-size:12px;">${isCompleted ? 'Завершена' : 'Отменена'}</span>` : `
              <select class="action-select status-select" data-id="${b.id}" style="max-width: 130px;">
                <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>Ожидает</option>
                <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Подтвердить</option>
                <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Отменить</option>
              </select>
              <button class="btn btn-outline apply-status-btn" data-id="${b.id}" style="padding: 6px 10px; font-size: 13px;" disabled>Применить</button>
              `}
            </td>
          </tr>
        `;
      }).join('');

      // Статус сначала выбираем, затем явно применяем кнопкой.
      document.querySelectorAll('.status-select').forEach(sel => {
        sel.dataset.originalStatus = sel.value;
        sel.addEventListener('change', (e) => {
          const row = e.target.closest('tr');
          const applyBtn = row && row.querySelector('.apply-status-btn');
          if (!applyBtn) return;
          applyBtn.disabled = e.target.value === e.target.dataset.originalStatus;
        });
      });

      document.querySelectorAll('.apply-status-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          const row = e.currentTarget.closest('tr');
          const select = row && row.querySelector('.status-select');
          if (!select) return;

          const newStatus = select.value;
          if (newStatus === select.dataset.originalStatus) return;
          if (newStatus === 'cancelled' && !confirm('Отменить эту бронь? Гость получит уведомление, а даты освободятся в календаре.')) return;

          e.currentTarget.disabled = true;
          select.disabled = true;
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
            select.disabled = false;
            e.currentTarget.disabled = false;
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
    if (document.hidden) return;
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

  setInterval(pollBookings, 20000);

  // Восстанавливаем заголовок при возвращении на вкладку
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      document.title = 'Бронирования | EcoGorniy Admin';
      pollBookings();
    }
  });

  // Логика модального окна редактирования
  const editModal = document.getElementById('editBookingModal');
  const closeEditBtn = document.getElementById('closeBookingModal');
  const cancelEditBtn = document.getElementById('cancelBookingEdit');
  const saveEditBtn = document.getElementById('saveBookingEdit');

  const closeModal = () => editModal.classList.remove('active');
  closeEditBtn.addEventListener('click', closeModal);
  cancelEditBtn.addEventListener('click', closeModal);

  saveEditBtn.addEventListener('click', async () => {
    const id = document.getElementById('editBookingId').value;
    const updateData = {
      guest_name: document.getElementById('editGuestName').value,
      guest_phone: document.getElementById('editGuestPhone').value,
      guest_telegram: document.getElementById('editGuestTelegram').value,
      check_in: document.getElementById('editCheckIn').value,
      check_out: document.getElementById('editCheckOut').value,
      total_price: parseInt(document.getElementById('editTotalPrice').value, 10)
    };

    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'Сохранение...';

    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      window.showToast('Бронирование обновлено', 'success');
      closeModal();
      loadBookings();
    } catch (err) {
      console.error(err);
      window.showToast('Ошибка сохранения', 'error');
    } finally {
      saveEditBtn.disabled = false;
      saveEditBtn.textContent = 'Сохранить';
    }
  });

});
