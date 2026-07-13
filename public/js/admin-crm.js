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
        
        return `
          <tr>
            <td data-label="Гость">
              <div style="font-weight:600; font-size:16px;">${g.name}</div>
            </td>
            <td data-label="Контакты">
              <div style="color:var(--cream);">${g.phone}</div>
              ${g.telegram ? `<div style="color:var(--muted); font-size:12px;">@${g.telegram.replace('@', '')}</div>` : ''}
            </td>
            <td data-label="Бронирования">
              <div style="font-weight:600;">${g.total_bookings} шт.</div>
              <small style="color:var(--muted); font-size:11px;">посл: ${lastBookingDate}</small>
            </td>
            <td data-label="LTV (Сумма)" style="font-weight:700; color:var(--gold); font-size:16px;">
              ${EcoApi.formatPrice(g.ltv)}
            </td>
            <td data-label="Заметки">
              <textarea class="notes-input" data-phone="${g.phone}" placeholder="Добавить заметку о клиенте...">${g.notes || ''}</textarea>
              <button class="save-notes-btn" data-phone="${g.phone}" style="display:none;">Сохранить</button>
            </td>
          </tr>
        `;
      }).join('');

      // Привязываем слушатели изменения заметок
      document.querySelectorAll('.notes-input').forEach(input => {
        const phone = input.dataset.phone;
        const saveBtn = document.querySelector(`.save-notes-btn[data-phone="${phone}"]`);
        
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
