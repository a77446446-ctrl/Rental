/**
 * Логика управления клиентами (Admin CRM)
 */

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('crmTableBody');

  async function loadGuests() {
    try {
      const res = await fetch('/api/admin/crm/guests');
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error);

      if (data.data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:32px;">Нет данных о гостях</td></tr>';
        return;
      }

      // Сортировка по LTV по убыванию
      const sortedGuests = data.data.sort((a, b) => b.ltv - a.ltv);

      tableBody.innerHTML = sortedGuests.map(g => {
        const lastBookingDate = new Date(g.last_booking).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const safeName = EcoApi.escapeHtml(g.name);
        const safePhone = EcoApi.escapeHtml(g.phone);
        const encodedPhone = encodeURIComponent(String(g.phone || ''));
        const safeTelegram = EcoApi.escapeHtml(String(g.telegram || '').replace('@', ''));
        const safeNotes = EcoApi.escapeHtml(g.notes || '');
        
        return `
          <tr>
            <td data-label="Гость">
              <div style="font-weight:600; font-size:16px;">${safeName}</div>
            </td>
            <td data-label="Контакты">
              <div style="color:var(--cream);">${safePhone}</div>
              ${g.telegram ? `<div style="color:var(--muted); font-size:12px;">@${safeTelegram}</div>` : ''}
            </td>
            <td data-label="Бронирования">
              <div style="font-weight:600;">${g.total_bookings} шт.</div>
              <small style="color:var(--muted); font-size:11px;">посл: ${lastBookingDate}</small>
            </td>
            <td data-label="LTV (Сумма)" style="font-weight:700; color:var(--gold); font-size:16px;">
              ${EcoApi.formatPrice(g.ltv)}
            </td>
            <td data-label="Заметки">
              <textarea class="notes-input" data-phone="${encodedPhone}" placeholder="Добавить заметку о клиенте...">${safeNotes}</textarea>
              <button class="save-notes-btn" data-phone="${encodedPhone}" style="display:none;">Сохранить</button>
            </td>
          </tr>
        `;
      }).join('');

      // Привязываем слушатели изменения заметок
      document.querySelectorAll('.notes-input').forEach(input => {
        const encodedPhone = input.dataset.phone;
        const phone = decodeURIComponent(encodedPhone);
        const saveBtn = document.querySelector(`.save-notes-btn[data-phone="${encodedPhone}"]`);
        
        input.addEventListener('input', () => {
          saveBtn.style.display = 'inline-block';
        });

        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Сохранение...';
          
          try {
            const res = await fetch(`/api/admin/crm/guests/${encodeURIComponent(phone)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes: input.value })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            
            window.showToast('Заметка сохранена', 'success');
            saveBtn.style.display = 'none';
          } catch (err) {
            console.error(err);
            window.showToast('Ошибка при сохранении заметки', 'error');
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
          }
        });
      });

    } catch (err) {
      console.error(err);
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#e57373; padding:32px;">Ошибка загрузки данных</td></tr>';
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

  loadGuests();
});
