(function() {
  'use strict';

  var state = { reviews: [], draft: null, loaded: false };
  var container;
  var addButton;
  var saveButton;

  function normalize(list) {
    return (Array.isArray(list) ? list : [])
      .filter(function(review) { return review && !review.placeholder && (review.text || review.author || review.source); })
      .slice(0, 3)
      .map(function(review) {
        return {
          rating: Math.max(1, Math.min(5, parseInt(review.rating, 10) || 5)),
          text: review.text || '',
          author: review.author || '',
          source: review.source || '',
          placeholder: false
        };
      });
  }

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function setDirty() {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.style.opacity = '1';
    }
  }

  function button(label, kind) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = kind === 'primary' ? 'btn btn-primary' : 'btn btn-ghost';
    btn.textContent = label;
    btn.style.cssText = 'min-height:34px;padding:0 12px;font-size:12px;border-color:var(--line);';
    if (kind === 'danger') {
      btn.style.borderColor = '#8b3c3c';
      btn.style.color = '#ff8c8c';
    }
    return btn;
  }

  function field(label, input) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:7px;';
    var lab = document.createElement('label');
    lab.textContent = label;
    lab.style.cssText = 'font-size:12px;color:var(--muted);font-weight:600;';
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function control(el) {
    el.style.cssText = 'background:rgba(237,228,214,0.05);border:1px solid var(--line);color:var(--cream);padding:9px 10px;border-radius:8px;color-scheme:dark;min-height:38px;width:100%;';
    return el;
  }

  function addDraft() {
    if (state.draft) return;
    if (state.reviews.length >= 3) {
      if (window.showToast) window.showToast('Можно добавить максимум 3 отзыва', 'info');
      render();
      return;
    }
    state.draft = { mode: 'add', index: -1, rating: 5, text: '', author: '', source: '' };
    render();
  }

  function editDraft(index) {
    var review = state.reviews[index];
    if (!review) return;
    state.draft = { mode: 'edit', index: index, rating: review.rating || 5, text: review.text || '', author: review.author || '', source: review.source || '' };
    render();
  }

  function saveDraft() {
    if (!state.draft) return;
    var review = {
      rating: Math.max(1, Math.min(5, parseInt((document.getElementById('adminReviewRating') || {}).value, 10) || 5)),
      author: ((document.getElementById('adminReviewAuthor') || {}).value || '').trim(),
      source: ((document.getElementById('adminReviewSource') || {}).value || '').trim(),
      text: ((document.getElementById('adminReviewText') || {}).value || '').trim(),
      placeholder: false
    };
    if (!review.text && !review.author && !review.source) {
      if (window.showToast) window.showToast('Заполните отзыв перед сохранением', 'error');
      return;
    }
    if (state.draft.mode === 'edit' && state.draft.index >= 0) {
      state.reviews[state.draft.index] = review;
    } else {
      state.reviews.push(review);
    }
    state.reviews = normalize(state.reviews);
    state.draft = null;
    setDirty();
    render();
  }

  function renderDraft() {
    if (!state.draft) return null;
    var form = document.createElement('div');
    form.style.cssText = 'display:grid;grid-template-columns:84px minmax(150px,.7fr) minmax(240px,1fr) auto;gap:10px;padding:12px;background:rgba(95,103,73,.10);border:1px solid rgba(187,164,111,.35);border-radius:8px;align-items:end;';
    var rating = control(document.createElement('select'));
    rating.id = 'adminReviewRating';
    [5,4,3,2,1].forEach(function(value) {
      var opt = document.createElement('option');
      opt.value = String(value);
      opt.textContent = String(value);
      if (Number(state.draft.rating || 5) === value) opt.selected = true;
      rating.appendChild(opt);
    });
    form.appendChild(field('Оценка', rating));
    var person = document.createElement('div');
    person.style.cssText = 'display:grid;gap:8px;';
    var author = control(document.createElement('input'));
    author.id = 'adminReviewAuthor';
    author.placeholder = 'Имя';
    author.value = state.draft.author || '';
    var source = control(document.createElement('input'));
    source.id = 'adminReviewSource';
    source.placeholder = 'Яндекс Отзывы';
    source.value = state.draft.source || '';
    person.appendChild(field('Имя гостя', author));
    person.appendChild(field('Источник', source));
    form.appendChild(person);
    var text = control(document.createElement('textarea'));
    text.id = 'adminReviewText';
    text.rows = 3;
    text.placeholder = 'Текст отзыва';
    text.value = state.draft.text || '';
    form.appendChild(field('Текст отзыва', text));
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    var save = button('Сохранить отзыв', 'primary');
    save.addEventListener('click', saveDraft);
    var cancel = button('Отмена');
    cancel.addEventListener('click', function() { state.draft = null; render(); });
    actions.appendChild(save);
    actions.appendChild(cancel);
    form.appendChild(actions);
    return form;
  }

  function render() {
    if (!container) return;
    container.innerHTML = '';
    if (addButton) {
      addButton.disabled = !!state.draft || state.reviews.length >= 3;
      addButton.style.opacity = addButton.disabled ? '.55' : '1';
      addButton.style.pointerEvents = addButton.disabled ? 'none' : 'auto';
    }
    if (!state.reviews.length) {
      var empty = document.createElement('div');
      empty.textContent = 'Отзывы пока не добавлены. Нажмите «Добавить отзыв», заполните форму и сохраните отзыв.';
      empty.style.cssText = 'padding:12px;border:1px dashed var(--line);border-radius:8px;color:var(--muted);font-size:13px;';
      container.appendChild(empty);
    }
    state.reviews.forEach(function(review, index) {
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:70px minmax(130px,.7fr) minmax(260px,1fr) auto;gap:12px;padding:12px;border:1px solid var(--line);border-radius:8px;background:rgba(237,228,214,.025);align-items:center;';
      row.innerHTML = '<div><strong style="color:var(--gold);font-size:18px;">' + (review.rating || 5) + '</strong><span style="display:block;color:var(--muted);font-size:11px;">оценка</span></div>' +
        '<div><strong style="display:block;color:var(--cream);font-size:14px;">' + esc(review.author || 'Имя') + '</strong><span style="display:block;color:var(--muted);font-size:12px;margin-top:3px;">' + esc(review.source || 'Источник') + '</span></div>' +
        '<div style="color:var(--cream-2);font-size:13px;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + esc(review.text || '') + '</div>';
      var actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
      var edit = button('Редактировать');
      edit.addEventListener('click', function() { editDraft(index); });
      var remove = button('Удалить', 'danger');
      remove.addEventListener('click', function() { state.reviews.splice(index, 1); setDirty(); render(); });
      actions.appendChild(edit);
      actions.appendChild(remove);
      row.appendChild(actions);
      container.appendChild(row);
    });
    var draft = renderDraft();
    if (draft) container.appendChild(draft);
  }

  async function load() {
    container = document.getElementById('reviewsContainer');
    addButton = document.getElementById('addReviewBtn');
    saveButton = document.getElementById('saveMainpageBtn');
    if (!container || !addButton) return;
    var cleanButton = addButton.cloneNode(true);
    addButton.parentNode.replaceChild(cleanButton, addButton);
    addButton = cleanButton;
    addButton.addEventListener('click', addDraft);
    try {
      var res = await fetch('/api/admin/mainpage', { cache: 'no-store' });
      var json = await res.json();
      state.reviews = normalize(json && json.data ? json.data.reviews : []);
    } catch (e) {
      state.reviews = [];
    }
    state.loaded = true;
    render();
  }

  window.AdminReviews = {
    getReviews: function() { return normalize(state.reviews); },
    render: render
  };

  document.addEventListener('DOMContentLoaded', load);
})();