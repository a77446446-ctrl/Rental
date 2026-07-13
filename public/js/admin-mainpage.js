document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('saveMainpageBtn');
  const featuresContainer = document.getElementById('featuresContainer');
  const reviewsContainer = document.getElementById('reviewsContainer');
  const addReviewBtn = document.getElementById('addReviewBtn');

  const defaultReviews = [];

  let mainpageData = {
    global_bg_url: '',
    logo: { url: '', text: '' },
    hero: { title: '', background_url: '' },
    marquee: { text: '' },
    about: { title: '', video_url: '', video_file_url: '', video_autoplay: false, video_start: 0, video_end: 0 },
    features_meta: { label: '', title: '' },
    features: [
      { title: '', subtitle: '', image_url: '' },
      { title: '', subtitle: '', image_url: '' },
      { title: '', subtitle: '', image_url: '' },
      { title: '', subtitle: '' , image_url: ''}
    ],
    territory: {
      background_url: '',
      title: '',
      desc: '',
      side_title: '',
      items: []
    },
    contacts: { label: '', title: '', desc: '', phone: '', email: '', cta_text: '', map_code: '', background_url: '' },
    reviews_meta: { label: '', title: '' },
    reviews: []
  };

  let tagsData = [];

  let reviewDraft = null;

  function makeReviewButton(label, variant) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost';
    button.textContent = label;
    button.style.cssText = 'min-height:34px;padding:0 12px;font-size:12px;border-color:var(--line);';
    if (variant === 'danger') {
      button.style.borderColor = '#8b3c3c';
      button.style.color = '#ff8c8c';
    }
    if (variant === 'primary') {
      button.className = 'btn btn-primary';
    }
    return button;
  }

  function normalizeReviews() {
    mainpageData.reviews = Array.isArray(mainpageData.reviews)
      ? mainpageData.reviews
          .filter(function(review) { return review && !review.placeholder && (review.text || review.author || review.source); })
          .slice(0, 3)
      : [];
  }

  function addReviewDraft() {
    normalizeReviews();
    if (reviewDraft) return;
    if (mainpageData.reviews.length >= 3) {
      showToast('Можно добавить максимум 3 отзыва', 'info');
      renderReviews();
      return;
    }
    reviewDraft = { mode: 'add', index: -1, rating: 5, text: '', author: '', source: '' };
    renderReviews();
  }

  function editReview(index) {
    normalizeReviews();
    const review = mainpageData.reviews[index];
    if (!review) return;
    reviewDraft = {
      mode: 'edit',
      index: index,
      rating: Math.max(1, Math.min(5, parseInt(review.rating, 10) || 5)),
      text: review.text || '',
      author: review.author || '',
      source: review.source || ''
    };
    renderReviews();
  }

  function cancelReviewDraft() {
    reviewDraft = null;
    renderReviews();
  }

  function commitReviewDraft() {
    if (!reviewDraft) return;
    const ratingField = document.getElementById('reviewDraftRating');
    const authorField = document.getElementById('reviewDraftAuthor');
    const sourceField = document.getElementById('reviewDraftSource');
    const textField = document.getElementById('reviewDraftText');

    const review = {
      rating: Math.max(1, Math.min(5, parseInt(ratingField ? ratingField.value : '5', 10) || 5)),
      author: authorField ? authorField.value.trim() : '',
      source: sourceField ? sourceField.value.trim() : '',
      text: textField ? textField.value.trim() : '',
      placeholder: false
    };

    if (!review.text && !review.author && !review.source) {
      showToast('Заполните отзыв перед сохранением', 'error');
      return;
    }

    normalizeReviews();
    if (reviewDraft.mode === 'edit' && reviewDraft.index >= 0) {
      mainpageData.reviews[reviewDraft.index] = review;
    } else {
      if (mainpageData.reviews.length >= 3) {
        showToast('Можно добавить максимум 3 отзыва', 'info');
        return;
      }
      mainpageData.reviews.push(review);
    }

    reviewDraft = null;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
    }
    renderReviews();
  }

  function deleteReview(index) {
    normalizeReviews();
    mainpageData.reviews.splice(index, 1);
    if (reviewDraft && reviewDraft.mode === 'edit' && reviewDraft.index === index) {
      reviewDraft = null;
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
    }
    renderReviews();
  }

  function makeField(labelText, field) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:7px;';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.cssText = 'font-size:12px;color:var(--muted);font-weight:600;';
    wrap.appendChild(label);
    wrap.appendChild(field);
    return wrap;
  }

  function styleReviewControl(field) {
    field.style.cssText = 'background:rgba(237,228,214,0.05);border:1px solid var(--line);color:var(--cream);padding:9px 10px;border-radius:8px;color-scheme:dark;min-height:38px;width:100%;';
    return field;
  }

  function renderReviewDraftForm() {
    if (!reviewDraft) return null;
    const form = document.createElement('div');
    form.style.cssText = 'display:grid;grid-template-columns:86px minmax(150px,.7fr) minmax(240px,1fr) auto;gap:10px;padding:12px;background:rgba(95,103,73,.10);border:1px solid rgba(187,164,111,.35);border-radius:8px;align-items:end;';

    const rating = styleReviewControl(document.createElement('select'));
    rating.id = 'reviewDraftRating';
    [5, 4, 3, 2, 1].forEach(function(value) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      if (Number(reviewDraft.rating || 5) === value) option.selected = true;
      rating.appendChild(option);
    });
    form.appendChild(makeField('Оценка', rating));

    const person = document.createElement('div');
    person.style.cssText = 'display:grid;gap:8px;';
    const author = styleReviewControl(document.createElement('input'));
    author.type = 'text';
    author.id = 'reviewDraftAuthor';
    author.placeholder = 'Имя';
    author.value = reviewDraft.author || '';
    const source = styleReviewControl(document.createElement('input'));
    source.type = 'text';
    source.id = 'reviewDraftSource';
    source.placeholder = 'Яндекс Отзывы';
    source.value = reviewDraft.source || '';
    person.appendChild(makeField('Имя гостя', author));
    person.appendChild(makeField('Источник', source));
    form.appendChild(person);

    const text = styleReviewControl(document.createElement('textarea'));
    text.id = 'reviewDraftText';
    text.rows = 3;
    text.placeholder = 'Текст отзыва';
    text.value = reviewDraft.text || '';
    form.appendChild(makeField('Текст отзыва', text));

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:flex-end;';
    const save = makeReviewButton('Сохранить отзыв', 'primary');
    save.addEventListener('click', commitReviewDraft);
    const cancel = makeReviewButton('Отмена');
    cancel.addEventListener('click', cancelReviewDraft);
    actions.appendChild(save);
    actions.appendChild(cancel);
    form.appendChild(actions);

    return form;
  }

  function renderReviews() {
    if (!reviewsContainer) return;
    normalizeReviews();
    reviewsContainer.innerHTML = '';

    if (addReviewBtn) {
      const disabled = !!reviewDraft || mainpageData.reviews.length >= 3;
      addReviewBtn.disabled = disabled;
      addReviewBtn.style.opacity = disabled ? '0.55' : '1';
      addReviewBtn.style.pointerEvents = disabled ? 'none' : 'auto';
    }

    if (mainpageData.reviews.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'Отзывы пока не добавлены. Нажмите «Добавить отзыв», заполните форму и сохраните отзыв.';
      empty.style.cssText = 'padding:12px;border:1px dashed var(--line);border-radius:8px;color:var(--muted);font-size:13px;';
      reviewsContainer.appendChild(empty);
    } else {
      mainpageData.reviews.forEach(function(review, index) {
        const row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:70px minmax(130px,.7fr) minmax(260px,1fr) auto;gap:12px;padding:12px;border:1px solid var(--line);border-radius:8px;background:rgba(237,228,214,.025);align-items:center;';

        const rating = document.createElement('div');
        rating.innerHTML = '<strong style="color:var(--gold);font-size:18px;">' + (review.rating || 5) + '</strong><span style="display:block;color:var(--muted);font-size:11px;">оценка</span>';
        row.appendChild(rating);

        const person = document.createElement('div');
        person.innerHTML = '<strong style="display:block;color:var(--cream);font-size:14px;">' + escapeReviewText(review.author || 'Имя') + '</strong><span style="display:block;color:var(--muted);font-size:12px;margin-top:3px;">' + escapeReviewText(review.source || 'Источник') + '</span>';
        row.appendChild(person);

        const text = document.createElement('div');
        text.textContent = review.text || '';
        text.style.cssText = 'color:var(--cream-2);font-size:13px;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;';
        row.appendChild(text);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
        const edit = makeReviewButton('Редактировать');
        edit.addEventListener('click', function() { editReview(index); });
        const remove = makeReviewButton('Удалить', 'danger');
        remove.addEventListener('click', function() { deleteReview(index); });
        actions.appendChild(edit);
        actions.appendChild(remove);
        row.appendChild(actions);

        reviewsContainer.appendChild(row);
      });
    }

    const draftForm = renderReviewDraftForm();
    if (draftForm) reviewsContainer.appendChild(draftForm);
  }

  function escapeReviewText(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function collectReviews() {
    normalizeReviews();
    return mainpageData.reviews.slice(0, 3);
  }

  if (addReviewBtn) {
    addReviewBtn.disabled = false;
    addReviewBtn.removeAttribute('disabled');
    addReviewBtn.style.pointerEvents = 'auto';
    addReviewBtn.addEventListener('click', addReviewDraft);
  }

  // Инициализация полей для "Почему здесь хорошо"
  function collectFeatures() {
    const arr = [];
    const featureCount = mainpageData.features ? mainpageData.features.length : 0;
    for (let i = 0; i < featureCount; i++) {
      const titleEl = document.getElementById(`featTitle_${i}`);
      if (!titleEl) continue; // if somehow deleted/missing
      arr.push({
        title: titleEl.value,
        subtitle: document.getElementById(`featSub_${i}`).value,
        image_url: document.getElementById(`featUrl_${i}`).value,
        icon: document.getElementById(`featIconBtn_${i}`).dataset.icon || ''
      });
    }
    mainpageData.features = arr;
  }

  function renderFeatures() {
    featuresContainer.innerHTML = '';
    mainpageData.features.forEach((feat, index) => {
      const div = document.createElement('div');
      div.style.display = 'grid';
      div.style.gridTemplateColumns = '1fr 1fr';
      div.style.gap = '16px';
      div.style.padding = '16px';
      div.style.background = 'rgba(237, 228, 214, 0.02)';
      div.style.border = '1px solid var(--line)';
      div.style.borderRadius = '8px';

      div.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 13px; color: var(--muted); font-weight: 600;">Пункт ${index + 1} - Заголовок</label>
            <button class="btn btn-ghost" type="button" id="featDeleteBtn_${index}" style="padding: 0; min-height: 24px; color: #ff8c8c; border-color: transparent; font-size: 11px;">Удалить</button>
          </div>
          <input type="text" id="featTitle_${index}" value="${feat.title}" style="background: rgba(237, 228, 214, 0.05); border: 1px solid var(--line); color: var(--cream); padding: 12px; border-radius: 8px;">
          
          <label style="font-size: 13px; color: var(--muted); font-weight: 600; margin-top: 8px;">Подзаголовок</label>
          <input type="text" id="featSub_${index}" value="${feat.subtitle}" style="background: rgba(237, 228, 214, 0.05); border: 1px solid var(--line); color: var(--cream); padding: 12px; border-radius: 8px;">
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 13px; color: var(--muted); font-weight: 600;">Иконка (Приоритетнее фото)</label>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-ghost" type="button" id="featIconBtn_${index}" style="padding: 0; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--line);" title="Выбрать иконку" data-icon="${feat.icon || ''}">
              ${feat.icon ? `<i data-lucide="${feat.icon}"></i>` : '<i data-lucide="plus"></i>'}
            </button>
            <span id="featIconName_${index}" style="color: var(--muted); font-size: 12px;">${feat.icon || 'Не выбрана'}</span>
            <button class="btn btn-ghost" type="button" id="featIconClearBtn_${index}" style="padding: 4px 8px; min-height: 24px; font-size: 11px; ${feat.icon ? '' : 'display: none;'}">Очистить</button>
          </div>

          <label style="font-size: 13px; color: var(--muted); font-weight: 600; margin-top: 8px;">Или загрузите фото</label>
          <input type="file" id="featFile_${index}" accept="image/*" style="background: rgba(237, 228, 214, 0.05); border: 1px solid var(--line); color: var(--cream); padding: 9px; border-radius: 8px;">
          <input type="hidden" id="featUrl_${index}" value="${feat.image_url || ''}">
          <div id="featPreview_${index}" style="margin-top: 8px; width: 100%; height: 80px; background-size: cover; background-position: center; border-radius: 8px; background-image: url('${feat.image_url || ''}'); border: 1px solid var(--line); ${feat.icon ? 'opacity: 0.3;' : ''}"></div>
        </div>
      `;
      featuresContainer.appendChild(div);

      // Icon Picker Logic
      const iconBtn = document.getElementById(`featIconBtn_${index}`);
      const iconNameLabel = document.getElementById(`featIconName_${index}`);
      const iconClearBtn = document.getElementById(`featIconClearBtn_${index}`);
      const previewDiv = document.getElementById(`featPreview_${index}`);
      
      iconBtn.addEventListener('click', () => {
        if (window.openIconPicker) {
          window.openIconPicker((iconName) => {
            iconBtn.dataset.icon = iconName;
            iconBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
            if (window.lucide) { window.lucide.createIcons({ root: iconBtn, nameAttr: 'data-lucide' }); }
            iconNameLabel.textContent = iconName;
            iconClearBtn.style.display = 'block';
            previewDiv.style.opacity = '0.3';
            if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
          });
        }
      });

      iconClearBtn.addEventListener('click', () => {
        iconBtn.dataset.icon = '';
        iconBtn.innerHTML = '<i data-lucide="plus"></i>';
        if (window.lucide) { window.lucide.createIcons({ root: iconBtn, nameAttr: 'data-lucide' }); }
        iconNameLabel.textContent = 'Не выбрана';
        iconClearBtn.style.display = 'none';
        previewDiv.style.opacity = '1';
        if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
      });

      // Обработчик загрузки фото
      document.getElementById(`featFile_${index}`).addEventListener('change', (e) => uploadImage(e.target, `featUrl_${index}`, `featPreview_${index}`));
      
      const deleteBtn = document.getElementById(`featDeleteBtn_${index}`);
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm('Удалить этот пункт?')) {
            collectFeatures();
            mainpageData.features.splice(index, 1);
            renderFeatures();
            if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
          }
        });
      }
    });

    if (window.lucide) { window.lucide.createIcons({ root: featuresContainer, nameAttr: 'data-lucide' }); }
  }

  const addFeatureBtn = document.getElementById('addFeatureBtn');
  if (addFeatureBtn) {
    addFeatureBtn.addEventListener('click', () => {
      collectFeatures();
      mainpageData.features.push({ title: '', subtitle: '', image_url: '', icon: '' });
      renderFeatures();
      if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
    });
  }

  function fillTerritoryFields() {
    const territory = mainpageData.territory || {};
    const items = Array.isArray(territory.items) ? territory.items : [];
    const title = document.getElementById('territoryTitle');
    const desc = document.getElementById('territoryDesc');
    const sideTitle = document.getElementById('territorySideTitle');
    if (title) title.value = territory.title || '';
    if (desc) desc.value = territory.desc || '';
    if (sideTitle) sideTitle.value = territory.side_title || '';
    for (let i = 0; i < 3; i++) {
      const item = items[i] || {};
      const itemTitle = document.getElementById('territoryItemTitle_' + i);
      const itemDesc = document.getElementById('territoryItemDesc_' + i);
      if (itemTitle) itemTitle.value = item.title || '';
      if (itemDesc) itemDesc.value = item.desc || '';
    }
  }

  function collectTerritoryFields() {
    const current = mainpageData.territory || {};
    const territory = {
      background_url: document.getElementById('territoryBgUrl').value,
      title: (document.getElementById('territoryTitle') || {}).value || '',
      desc: (document.getElementById('territoryDesc') || {}).value || '',
      side_title: (document.getElementById('territorySideTitle') || {}).value || '',
      items: []
    };
    for (let i = 0; i < 3; i++) {
      territory.items.push({
        title: (document.getElementById('territoryItemTitle_' + i) || {}).value || '',
        desc: (document.getElementById('territoryItemDesc_' + i) || {}).value || ''
      });
    }
    return Object.assign({}, current, territory);
  }

  // Загрузка данных с сервера
  async function loadData() {
    try {
      const resMain = await fetch('/api/admin/mainpage');
      const jsonMain = await resMain.json();
      if (jsonMain.success && jsonMain.data) {
        // Мержим с дефолтными
        mainpageData = { ...mainpageData, ...jsonMain.data };
      }

      const resTags = await fetch('/api/admin/tags');
      const jsonTags = await resTags.json();
      if (jsonTags.success && jsonTags.data) {
        tagsData = jsonTags.data;
      }

      // Заполняем форму
      document.getElementById('logoText').value = mainpageData.logo?.text || '';
      document.getElementById('logoUrl').value = mainpageData.logo?.url || '';
      if (mainpageData.logo?.url) {
        document.getElementById('logoPreview').innerHTML = `<img src="${mainpageData.logo.url}" style="max-height: 50px;">`;
      }

      document.getElementById('heroTitle').value = mainpageData.hero?.title || '';
      document.getElementById('heroBgUrl').value = mainpageData.hero?.background_url || '';
      if (mainpageData.hero?.background_url) {
        document.getElementById('heroPreview').style.backgroundImage = `url('${mainpageData.hero.background_url}')`;
      }
      document.getElementById('heroDesc').value = mainpageData.hero?.desc || '';

      document.getElementById('globalBgUrl').value = mainpageData.global_bg_url || '';
      if (mainpageData.global_bg_url) {
        document.getElementById('globalBgPreview').style.backgroundImage = `url('${mainpageData.global_bg_url}')`;
      }

      document.getElementById('marqueeText').value = mainpageData.marquee?.text || '';
      document.getElementById('featuresLabel').value = mainpageData.features_meta?.label || '';
      document.getElementById('featuresTitle').value = mainpageData.features_meta?.title || '';
      
      document.getElementById('aboutTitle').value = mainpageData.about?.title || '';
      document.getElementById('aboutDesc').value = mainpageData.about?.desc || '';
      document.getElementById('aboutVideoUrl').value = mainpageData.about?.video_url || '';
      document.getElementById('aboutVideoFileUrl').value = mainpageData.about?.video_file_url || '';
      if (mainpageData.about?.video_file_url) {
        document.getElementById('aboutVideoPreview').textContent = 'Файл загружен: ' + mainpageData.about.video_file_url.split('/').pop();
      }
      document.getElementById('aboutVideoAutoplay').checked = !!mainpageData.about?.video_autoplay;
      document.getElementById('aboutVideoStart').value = mainpageData.about?.video_start || '';
      document.getElementById('aboutVideoEnd').value = mainpageData.about?.video_end || '';

      document.getElementById('territoryBgUrl').value = mainpageData.territory?.background_url || '';
      if (mainpageData.territory?.background_url) {
        document.getElementById('territoryPreview').style.backgroundImage = `url('${mainpageData.territory.background_url}')`;
      }
      fillTerritoryFields();

      document.getElementById('contactLabel').value = mainpageData.contacts?.label || '';
      document.getElementById('contactTitle').value = mainpageData.contacts?.title || '';
      document.getElementById('contactDesc').value = mainpageData.contacts?.desc || '';
      document.getElementById('contactPhone').value = mainpageData.contacts?.phone || '';
      document.getElementById('contactEmail').value = mainpageData.contacts?.email || '';
      document.getElementById('contactCta').value = mainpageData.contacts?.cta_text || '';
      document.getElementById('contactMapCoords').value = mainpageData.contacts?.map_code || '';
      
      document.getElementById('contactBgUrl').value = mainpageData.contacts?.background_url || '';
      if (mainpageData.contacts?.background_url) {
        document.getElementById('contactBgPreview').style.backgroundImage = `url('${mainpageData.contacts.background_url}')`;
      }

      if (typeof initAdminMap === 'function') initAdminMap();

      document.getElementById('tagsInput').value = tagsData.join(', ');
      document.getElementById('reviewsLabel').value = mainpageData.reviews_meta?.label || '';
      document.getElementById('reviewsTitle').value = mainpageData.reviews_meta?.title || '';

      normalizeReviews();
      renderFeatures();
      renderReviews();

    } catch (err) {
      console.error('Error loading data', err);
      showToast('Ошибка загрузки данных', 'error');
    }
  }

  // Универсальная функция загрузки
  async function uploadImage(fileInput, urlInputId, previewId) {
    if (!fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('photo', file);

    try {
      showToast('Загрузка изображения...', 'info');
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.success) {
        document.getElementById(urlInputId).value = json.url;
        const preview = document.getElementById(previewId);
        if (preview.tagName.toLowerCase() === 'div') {
          preview.style.backgroundImage = `url('${json.url}')`;
        } else {
          preview.innerHTML = `<img src="${json.url}" style="max-height: 50px;">`;
        }
        showToast('Изображение загружено', 'success');
      } else {
        showToast(json.error || 'Ошибка загрузки', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Ошибка сети при загрузке', 'error');
    }
  }

  // Обработчики кнопок загрузки
  document.getElementById('globalBgFile').addEventListener('change', (e) => uploadImage(e.target, 'globalBgUrl', 'globalBgPreview'));
  document.getElementById('logoFile').addEventListener('change', (e) => uploadImage(e.target, 'logoUrl', 'logoPreview'));
  document.getElementById('heroFile').addEventListener('change', (e) => uploadImage(e.target, 'heroBgUrl', 'heroPreview'));
  document.getElementById('territoryFile').addEventListener('change', (e) => uploadImage(e.target, 'territoryBgUrl', 'territoryPreview'));
  document.getElementById('aboutVideoFile').addEventListener('change', (e) => uploadImage(e.target, 'aboutVideoFileUrl', 'aboutVideoPreview'));
  document.getElementById('contactBgFile').addEventListener('change', (e) => uploadImage(e.target, 'contactBgUrl', 'contactBgPreview'));

  // Сохранение
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    // Собираем данные
    mainpageData.global_bg_url = document.getElementById('globalBgUrl').value;
    
    mainpageData.logo.text = document.getElementById('logoText').value;
    mainpageData.logo.url = document.getElementById('logoUrl').value;

    mainpageData.hero.title = document.getElementById('heroTitle').value;
    mainpageData.hero.background_url = document.getElementById('heroBgUrl').value;
    mainpageData.hero.desc = document.getElementById('heroDesc').value;

    mainpageData.marquee.text = document.getElementById('marqueeText').value;
    mainpageData.features_meta = {
      label: document.getElementById('featuresLabel').value,
      title: document.getElementById('featuresTitle').value
    };

    mainpageData.about.title = document.getElementById('aboutTitle').value;
    mainpageData.about.desc = document.getElementById('aboutDesc').value;
    mainpageData.about.video_url = document.getElementById('aboutVideoUrl').value;
    mainpageData.about.video_file_url = document.getElementById('aboutVideoFileUrl').value;
    mainpageData.about.video_autoplay = document.getElementById('aboutVideoAutoplay').checked;
    mainpageData.about.video_start = parseInt(document.getElementById('aboutVideoStart').value) || 0;
    mainpageData.about.video_end = parseInt(document.getElementById('aboutVideoEnd').value) || 0;

    collectFeatures();
    // mainpageData.features уже обновлен через collectFeatures()

    mainpageData.territory = collectTerritoryFields();

    mainpageData.reviews = collectReviews();
    mainpageData.reviews_meta = {
      label: document.getElementById('reviewsLabel').value,
      title: document.getElementById('reviewsTitle').value
    };

    mainpageData.contacts = mainpageData.contacts || {};
    mainpageData.contacts.label = document.getElementById('contactLabel').value;
    mainpageData.contacts.title = document.getElementById('contactTitle').value;
    mainpageData.contacts.desc = document.getElementById('contactDesc').value;
    mainpageData.contacts.phone = document.getElementById('contactPhone').value;
    mainpageData.contacts.email = document.getElementById('contactEmail').value;
    mainpageData.contacts.cta_text = document.getElementById('contactCta').value;
    mainpageData.contacts.map_code = document.getElementById('contactMapCoords').value;
    mainpageData.contacts.background_url = document.getElementById('contactBgUrl').value;

    const tagsArr = document.getElementById('tagsInput').value
      .split(',')
      .map(t => t.trim())
      .filter(t => t);

    try {
      const resMain = await fetch('/api/admin/mainpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mainpageData)
      });
      const resTags = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tagsArr })
      });

      if (resMain.ok && resTags.ok) {
        showToast('Настройки главной страницы сохранены', 'success');
        reviewDraft = null;
        renderReviews();
        // Делаем кнопку неактивной после успешного сохранения
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
      } else {
        showToast('Ошибка при сохранении', 'error');
        saveBtn.disabled = false;
      }
    } catch (err) {
      console.error(err);
      showToast('Ошибка сети', 'error');
      saveBtn.disabled = false;
    } finally {
      saveBtn.textContent = 'Сохранить изменения';
    }
  });

  // Логика "грязного" состояния (disable/enable кнопки Сохранить)
  saveBtn.disabled = true;
  saveBtn.style.opacity = '0.5';
  document.addEventListener('input', () => {
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
  });
  document.addEventListener('change', () => {
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
  });

  // Очистка видео (URL и Файл)
  document.getElementById('clearVideoUrlBtn').addEventListener('click', () => {
    document.getElementById('aboutVideoUrl').value = '';
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
  });
  document.getElementById('clearVideoFileBtn').addEventListener('click', () => {
    document.getElementById('aboutVideoFile').value = '';
    document.getElementById('aboutVideoFileUrl').value = '';
    document.getElementById('aboutVideoPreview').innerHTML = '';
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
  });

  // Вспомогательная функция для тостов, если её нет в глобальном скоупе
  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    alert(message);
  }

  let adminMap;
  let adminPlacemark;

  function initAdminMap() {
    if (typeof ymaps === 'undefined') return;
    ymaps.ready(() => {
      // Предотвращаем повторную инициализацию
      if (adminMap) return;

      const coordsStr = document.getElementById('contactMapCoords').value;
      let center = [55.753994, 37.622093]; // Moscow
      let zoom = 9;

      if (coordsStr && coordsStr.includes(',')) {
        center = coordsStr.split(',').map(Number);
        zoom = 14;
      }

      adminMap = new ymaps.Map('adminYandexMap', {
        center: center,
        zoom: zoom
      });

      if (coordsStr && coordsStr.includes(',')) {
        adminPlacemark = new ymaps.Placemark(center, {}, { preset: 'islands#redIcon' });
        adminMap.geoObjects.add(adminPlacemark);
      }

      adminMap.events.add('click', function (e) {
        const coords = e.get('coords');
        document.getElementById('contactMapCoords').value = coords.join(',');
        
        if (adminPlacemark) {
          adminPlacemark.geometry.setCoordinates(coords);
        } else {
          adminPlacemark = new ymaps.Placemark(coords, {}, { preset: 'islands#redIcon' });
          adminMap.geoObjects.add(adminPlacemark);
        }
        
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
      });
    });
  }

  const clearMapBtn = document.getElementById('clearMapBtn');
  if (clearMapBtn) {
    clearMapBtn.addEventListener('click', () => {
      document.getElementById('contactMapCoords').value = '';
      if (adminMap && adminPlacemark) {
        adminMap.geoObjects.remove(adminPlacemark);
        adminPlacemark = null;
      }
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
    });
  }

  loadData();
});
