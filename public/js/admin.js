/**
 * Скрипт оболочки админ-панели (Dashboard Shell)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Обработчик выхода
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

  // Навигация (Shell)
  const menuItems = document.querySelectorAll('.admin-menu-item');
  const viewTitle = document.getElementById('viewTitle');
  const tableBody = document.getElementById('tableBody');
  const viewContainer = document.getElementById('viewContainer');

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Меняем активный класс
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const view = item.dataset.view;
      viewTitle.textContent = item.textContent;

      // Очистка таблицы
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted);">Загрузка данных...</td></tr>';
      }

      // Эмуляция загрузки данных (shell behavior)
      setTimeout(() => {
        renderMockData(view);
      }, 400);
    });
  });

  // Функция для отрисовки заглушек (до реализации реальных API методов в следующих SET)
  function renderMockData(view) {
    if (!viewContainer) return;

    if (view === 'bookings') {
      viewContainer.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr><th>ID</th><th>Гость</th><th>Даты</th><th>Домик</th><th>Сумма</th><th>Статус</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>#1042</td><td>Иван Иванов<br><small style="color: var(--muted-2);">+7 (999) 123-45-67</small></td>
              <td>12.08 — 15.08<br><small style="color: var(--muted-2);">3 ночи</small></td>
              <td>A-Frame Лесной</td><td>45 000 ₽</td>
              <td><span style="color: #bba46f;">Ожидает</span></td>
            </tr>
            <tr>
              <td>#1041</td><td>Анна Смирнова<br><small style="color: var(--muted-2);">@anna_s</small></td>
              <td>01.08 — 03.08<br><small style="color: var(--muted-2);">2 ночи</small></td>
              <td>Сфера Звездная</td><td>32 000 ₽</td>
              <td><span style="color: #5f6749;">Подтверждена</span></td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (view === 'chats') {
      viewContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--muted); border: 1px solid var(--line); border-radius: 12px; background: rgba(237, 228, 214, 0.02);">
          Здесь будет интерфейс чатов с гостями (Supabase Realtime)
        </div>
      `;
    } else if (view === 'cabins') {
      viewContainer.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr><th>ID</th><th>Название</th><th>Вместимость</th><th>Базовая цена</th><th>Действия</th></tr>
          </thead>
          <tbody>
            <tr><td>#1</td><td>A-Frame Лесной</td><td>до 4 гостей</td><td>15 000 ₽</td><td><button class="btn btn-ghost" style="padding: 4px 12px; min-height: 28px;">Редактировать</button></td></tr>
            <tr><td>#2</td><td>Сфера Звездная</td><td>до 2 гостей</td><td>12 000 ₽</td><td><button class="btn btn-ghost" style="padding: 4px 12px; min-height: 28px;">Редактировать</button></td></tr>
          </tbody>
        </table>
      `;
    } else {
      viewContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--muted); border: 1px solid var(--line); border-radius: 12px; background: rgba(237, 228, 214, 0.02);">
          Раздел "${viewTitle.textContent}" находится в разработке
        </div>
      `;
    }
  }

  // Загружаем начальный вид (брони)
  renderMockData('bookings');
});
