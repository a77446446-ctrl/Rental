// Global Icon Picker Modal
window.openIconPicker = function(onSelectCallback) {
  let modal = document.getElementById('iconPickerModal');
  
  if (!modal) {
    // Create modal
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

    document.getElementById('iconSearchInput').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.icon-grid-item').forEach(el => {
        const name = el.dataset.icon;
        if (name.includes(q)) {
          el.style.display = 'flex';
        } else {
          el.style.display = 'none';
        }
      });
    });

    // Populate grid
    const grid = document.getElementById('iconPickerGrid');
    if (window.GLAMPING_ICONS) {
      window.GLAMPING_ICONS.forEach(icon => {
        const item = document.createElement('div');
        item.className = 'icon-grid-item';
        item.dataset.icon = icon;
        item.innerHTML = `
          <i data-lucide="${icon}"></i>
          <span>${icon}</span>
        `;
        item.addEventListener('click', () => {
          if (modal.onSelect) modal.onSelect(icon);
          modal.classList.remove('open');
        });
        grid.appendChild(item);
      });
    }
  }

  // Render icons if Lucide is loaded
  if (window.lucide) {
    window.lucide.createIcons({
      root: modal
    });
  }

  document.getElementById('iconSearchInput').value = '';
  document.querySelectorAll('.icon-grid-item').forEach(el => el.style.display = 'flex');

  modal.onSelect = onSelectCallback;
  modal.classList.add('open');
};
