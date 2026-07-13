// Глобальное модальное окно выбора иконки
window.openIconPicker = function(onSelectCallback) {
  let modal = document.getElementById('iconPickerModal');
  
  if (!modal) {
    // Создаём модальное окно
    modal = document.createElement('div');
    modal.id = 'iconPickerModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Выберите иконку</h3>
          <button class="modal-close" id="closeIconPickerBtn">&times;</button>
        </div>
        <div class="modal-body">
          <input type="text" id="iconSearchInput" placeholder="Поиск иконок..." style="width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--line); border-radius: 8px; color: var(--cream); margin-bottom: 12px;">
          <div class="icon-grid" id="iconPickerGrid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('closeIconPickerBtn').addEventListener('click', () => {
      modal.classList.remove('open');
    });

    // Поиск по русским и английским названиям
    document.getElementById('iconSearchInput').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.icon-grid-item').forEach(el => {
        const iconId = el.dataset.icon;
        const label = (el.dataset.label || '').toLowerCase();
        if (iconId.includes(q) || label.includes(q)) {
          el.style.display = 'flex';
        } else {
          el.style.display = 'none';
        }
      });
    });

    // Заполняем сетку иконок
    const grid = document.getElementById('iconPickerGrid');
    const icons = window.GLAMPING_ICONS || [];
    const labels = window.GLAMPING_ICONS_LABELS || {};

    icons.forEach(icon => {
      const label = labels[icon] || icon;
      const item = document.createElement('div');
      item.className = 'icon-grid-item';
      item.dataset.icon = icon;
      item.dataset.label = label;
      item.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span>${label}</span>
      `;
      item.addEventListener('click', () => {
        if (modal.onSelect) modal.onSelect(icon);
        modal.classList.remove('open');
      });
      grid.appendChild(item);
    });
    // Рендерим иконки Lucide только при создании модалки
    setTimeout(() => {
      if (window.lucide) { window.lucide.createIcons({ root: grid, nameAttr: 'data-lucide' }); }
    }, 50);
  }

  document.getElementById('iconSearchInput').value = '';
  document.querySelectorAll('.icon-grid-item').forEach(el => el.style.display = 'flex');

  modal.onSelect = onSelectCallback;
  modal.classList.add('open');
};
