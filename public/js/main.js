/**
 * Основной скрипт eco-gorniy.ru
 * Связывает UI с API, управляет состоянием бронирования.
 */

(function () {
  'use strict';

  // Бренд и контакты подставляются только из настроек администратора.

  /* Вспомогательная функция для тостов (уведомлений) */
  window.showToast = function (message, type) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'success');
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.35s ease';
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 350);
    }, 4000);
  };

  /* Пасхалка: секретный вход в админку */
  var logoBtn = document.getElementById('main-logo-link');
  var logoClicks = 0;
  var logoClickTimer = null;

  if (logoBtn) {
    logoBtn.addEventListener('click', function (e) {
      e.preventDefault();
      logoClicks++;

      if (logoClicks >= 6) {
        window.location.href = '/admin/login';
      }

      clearTimeout(logoClickTimer);
      logoClickTimer = setTimeout(function () {
        logoClicks = 0;
      }, 1000); // Сброс, если интервал между кликами больше 1 секунды
    });
  }

  /* Плавный скролл по якорным ссылкам */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var targetId = link.getAttribute("href");
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (!target) return;
      
      /* Разрешаем клик по логотипу для пасхалки */
      if (link.id !== 'main-logo-link') {
        event.preventDefault();
      }
      
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* Инициализация глобального стейта */
  var state = {
    cabins: [],
    extraServices: [],
    settings: { checkInTime: '16:00', checkOutTime: '14:00' },
    amenities: {},
    selectedCabinId: null,
    selectedDates: [], // массив выбранных дат с ценами
    selectedExtras: [], // массив id выбранных услуг
    mainpage: {},
    tags: [],
    cabinTags: {},
    currentTagFilter: 'all'
  };

  /* Элементы UI */
  var els = {
    housesGrid: document.getElementById('houses-grid'),
    quickHouse: document.getElementById('quickHouse'),
    quickTotal: document.getElementById('quickTotal'),
    quickCheckIn: document.getElementById('quickCheckIn'),
    quickCheckOut: document.getElementById('quickCheckOut'),
    extrasContainer: document.getElementById('extras-container'),
    rentTotal: document.getElementById('rent-total'),
    extrasTotal: document.getElementById('extras-total'),
    grandTotal: document.getElementById('grand-total'),
    calTitle: document.getElementById('cal-title'),
    calSubtitle: document.getElementById('cal-subtitle'),
    calPrev: document.getElementById('cal-prev'),
    calNext: document.getElementById('cal-next'),
    calGrid: document.getElementById('calendarGrid'),
    quickGuests: document.getElementById('quickGuests'),
    btnQuickSearch: document.getElementById('btnQuickSearch'),
    housesSearchResult: document.getElementById('houses-search-result'),
    housesSearchText: document.getElementById('houses-search-text'),
    btnResetSearch: document.getElementById('btnResetSearch'),
    checkoutDatesInfo: document.getElementById('checkoutDatesInfo'),
    checkoutGuests: document.getElementById('checkoutGuests')
  };

  var loadIssues = [];

  function setAppLoading(message, title) {
    var overlay = document.getElementById('app-loading');
    if (!overlay) return;
    var titleEl = document.getElementById('app-loading-title');
    var textEl = document.getElementById('app-loading-text');
    overlay.classList.remove('is-hidden', 'has-error');
    document.body.classList.add('app-loading-active');
    if (titleEl && title) titleEl.textContent = title;
    if (textEl && message) textEl.textContent = message;
  }

  function hideAppLoading() {
    var overlay = document.getElementById('app-loading');
    document.body.classList.remove('app-loading-active');
    if (!overlay) return;
    overlay.classList.add('is-hidden');
  }

  function showAppLoadingError(message) {
    var overlay = document.getElementById('app-loading');
    if (!overlay) return;
    overlay.classList.add('has-error');
    overlay.classList.remove('is-hidden');
    document.body.classList.add('app-loading-active');
    var titleEl = document.getElementById('app-loading-title');
    var textEl = document.getElementById('app-loading-text');
    if (titleEl) titleEl.textContent = 'База данных не ответила';
    if (textEl) textEl.textContent = message || 'Проверьте подключение к Supabase и повторите загрузку.';
    var retryBtn = document.getElementById('app-loading-retry');
    if (retryBtn && !retryBtn.dataset.bound) {
      retryBtn.dataset.bound = '1';
      retryBtn.addEventListener('click', function () {
        window.location.reload();
      });
    }
  }

  function fetchJsonWithTimeout(url, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () {
      controller.abort();
    }, timeoutMs || 12000) : null;

    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (res) {
        return res.ok ? res.json() : {};
      })
      .catch(function (err) {
        console.error('[main] request failed:', url, err.name === 'AbortError' ? 'request timeout' : err.message);
        return {};
      })
      .finally(function () {
        if (timeoutId) clearTimeout(timeoutId);
      });
  }

  function safeLoad(label, promise, fallback) {
    return Promise.resolve(promise)
      .then(function (value) {
        if (value === null || typeof value === 'undefined') {
          loadIssues.push(label);
          return fallback;
        }
        return value;
      })
      .catch(function (err) {
        console.error('[main] load failed:', label, err);
        loadIssues.push(label);
        return fallback;
      });
  }

  // Установка минимальной даты для нативных календарей (чтобы нельзя было выбрать прошедшие дни)
  if (els.quickCheckIn && els.quickCheckOut) {
    var todayStr = new Date().toLocaleDateString('en-CA'); // формат YYYY-MM-DD в локальном часовом поясе
    els.quickCheckIn.min = todayStr;
    els.quickCheckOut.min = todayStr;
  }

  /* Экземпляр календаря */
  var calendar = null;

  /**
   * Обновляет итоговую стоимость в блоке "Оформление заявки", вызывая /api/bookings/calculate
   */
  async function updateCheckoutSummary() {
    var rentSum = 0;
    
    // Считаем аренду (сумма по всем выбранным датам) локально для быстрого отображения
    if (state.selectedDates.length > 0) {
      for (var i = 0; i < state.selectedDates.length; i++) {
        rentSum += state.selectedDates[i].price;
      }
    } else {
      var cabin = state.cabins.find(function(c) { return c.id === state.selectedCabinId; });
      if (cabin) {
        rentSum = cabin.base_price * 2;
      }
    }

    var extrasSum = 0;
    var checkboxes = document.querySelectorAll('.extra-checkbox');
    var selectedExtras = [];
    checkboxes.forEach(function (cb) {
      if (cb.checked) {
        extrasSum += Number(cb.value);
        selectedExtras.push(cb.dataset.id);
      }
    });

    els.rentTotal.textContent = EcoApi.formatPrice(rentSum);
    els.extrasTotal.textContent = EcoApi.formatPrice(extrasSum);
    els.grandTotal.textContent = EcoApi.formatPrice(rentSum + extrasSum);

    // Обновляем текст заезда/выезда на странице
    if (els.checkoutDatesInfo) {
      if (state.selectedDates.length > 0) {
        var sortedForText = [...state.selectedDates].sort((a,b) => a.date.localeCompare(b.date));
        var inD = sortedForText[0].date;
        var outD = sortedForText[sortedForText.length - 1].date;
        var realOut = new Date(outD);
        realOut.setDate(realOut.getDate() + 1);
        outD = realOut.toISOString().split('T')[0];
        
        els.checkoutDatesInfo.textContent = EcoApi.formatDateShort(inD) + ' — ' + EcoApi.formatDateShort(outD) + ' (' + state.selectedDates.length + ' ноч' + (state.selectedDates.length === 1 ? 'ь' : (state.selectedDates.length >= 2 && state.selectedDates.length <= 4 ? 'и' : 'ей')) + ')';
      } else {
        els.checkoutDatesInfo.textContent = 'Не выбраны';
      }
    }

    // Если даты выбраны, запрашиваем точный расчет с сервера
    if (state.selectedDates.length > 0) {
      // Даты должны быть отсортированы
      var sortedDates = [...state.selectedDates].sort((a,b) => a.date.localeCompare(b.date));
      var check_in = sortedDates[0].date;
      var check_out = sortedDates[sortedDates.length - 1].date; // Это последняя ночь. Выезд будет +1 день
      
      var outDate = new Date(check_out);
      outDate.setDate(outDate.getDate() + 1);
      check_out = outDate.toISOString().split('T')[0];

      try {
        state.currentCalc = {
          rent_price: rentSum,
          extras_price: extrasSum,
          total_price: rentSum + extrasSum
        };
      } catch (err) {
        console.error('Calculation error:', err);
      }
    } else {
      state.currentCalc = null;
    }
  }

  /**
   * Обновляет "Быстрый подбор"
   */
  function updateQuickTotal() {
    var cabinId = els.quickHouse.value;
    if (!cabinId) {
      els.quickTotal.textContent = '—';
      return;
    }
    var cabin = state.cabins.find(function(c) { return c.id === cabinId; });
    if (cabin) {
      // Предварительно за 2 ночи
      els.quickTotal.textContent = EcoApi.formatPrice(cabin.base_price * 2);
    } else {
      els.quickTotal.textContent = '0 ₽';
    }
  }

  /**
   * Выбор домика
   */
  async function selectCabin(cabinId) {
    state.selectedCabinId = cabinId;
    els.quickHouse.value = cabinId || "";
    updateQuickTotal();
    setCheckoutGuests(els.checkoutGuests ? els.checkoutGuests.value : (els.quickGuests ? els.quickGuests.value : 2));
    
    var cabin = state.cabins.find(function(c) { return c.id === cabinId; });
    if (cabin && calendar) {
      await calendar.setCabin(cabin.id, cabin.name, cabin.base_price);
    }
    
    renderExtraServices();
    updateCheckoutSummary();
  }

  /**
   * Отрисовка домиков
   */
  async function renderCabins() {
    if (!els.housesGrid) return;
    
    els.housesGrid.innerHTML = '';
    els.quickHouse.innerHTML = '<option value="">Любой домик</option>';

    let cabinsToRender = state.currentTagFilter === 'all'
      ? state.cabins
      : state.cabins.filter(c => (state.cabinTags[c.id] || []).includes(state.currentTagFilter));

    if (cabinsToRender.length === 0 && state.currentTagFilter !== 'all' && state.cabins.length > 0) {
      state.currentTagFilter = 'all';
      const filtersContainer = document.getElementById('cabins-filters');
      if (filtersContainer) {
        filtersContainer.querySelectorAll('.filter').forEach(function(filter) {
          filter.classList.toggle('active', filter.dataset.tag === 'all');
        });
      }
      cabinsToRender = state.cabins;
    }

    // Обновляем теги территории (названия домиков)
    const territoryTags = document.getElementById('territory-tags-container');
    if (territoryTags && state.cabins.length > 0) {
      territoryTags.innerHTML = state.cabins.map(c => `<span>${c.name}</span>`).join('');
    }

    if (cabinsToRender.length === 0) {
      els.housesGrid.innerHTML = '<p class="mobile-empty-state">Домики пока не загрузились. Обновите страницу или попробуйте чуть позже.</p>';
      if (els.calTitle) els.calTitle.textContent = 'Домики не загружены';
      if (els.calSubtitle) els.calSubtitle.textContent = 'Обновите страницу';
      return;
    }

    cabinsToRender.forEach(function (cabin, index) {
      // Получаем главное фото
      var mainImg = (cabin.images && cabin.images.length > 0) 
        ? cabin.images.find(img => img.category === 'main') || cabin.images[0] 
        : null;
      var imageStyle = mainImg && mainImg.url ? `--img: url('${mainImg.url}');` : '';

      var article = document.createElement('article');
      article.className = 'house-card';
      article.innerHTML = `
        <div class="house-image" style="${imageStyle}"></div>
        <div class="house-content">
          <span class="house-num">${String(index + 1).padStart(2, '0')}</span>
          <h3>${cabin.name}</h3>
          <p>${cabin.description || ''}</p>
          <div class="house-meta">
            <span class="chip">до ${cabin.capacity} гостей</span>
            <span class="chip">от ${EcoApi.formatPrice(cabin.base_price)}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-primary select-cabin-btn" data-id="${cabin.id}" style="flex: 1;">Выбрать</button>
            <a href="/cabin.html?id=${cabin.id}" class="btn btn-ghost" style="flex: 1; min-height: 48px; border: 1px solid var(--line); border-radius: 6px; display: flex; align-items: center; justify-content: center; text-decoration: none;">Подробно</a>
          </div>
        </div>
      `;
      els.housesGrid.appendChild(article);
    });

    // Добавляем опции в селект только один раз при инициализации
    if (els.quickHouse.options.length <= 1) {
      state.cabins.forEach(function (cabin) {
        var option = document.createElement('option');
        option.value = cabin.id;
        option.textContent = cabin.name;
        els.quickHouse.appendChild(option);
      });
    }

      // Обработчики кнопок "Выбрать"
      document.querySelectorAll('.select-cabin-btn').forEach(function(btn) {
        btn.addEventListener('click', async function(e) {
          var cid = e.target.getAttribute('data-id');
          await selectCabin(cid);
          if (els.quickGuests) setCheckoutGuests(els.quickGuests.value);
          
          // Если есть выбранные даты в быстром поиске, установим их
          var quickIn = els.quickCheckIn ? els.quickCheckIn.value : null;
          var quickOut = els.quickCheckOut ? els.quickCheckOut.value : null;
          if (quickIn && quickOut && calendar) {
             // Используем метод календаря, если он есть
             if (typeof calendar.setSelection === 'function') {
               calendar.setSelection(quickIn, quickOut);
             }
          }

          // Скролл к календарю
          document.querySelector('#calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    // Обработчик селекта быстрого выбора
    els.quickHouse.addEventListener('change', async function(e) {
      await selectCabin(e.target.value);
    });

    // Проверяем параметр в URL
    var urlParams = new URLSearchParams(window.location.search);
    var preselectId = urlParams.get('cabin');
    
    if (preselectId && state.cabins.find(c => c.id === preselectId)) {
      await selectCabin(preselectId);
      if (window.location.hash === '#calendar') {
        setTimeout(function() {
          document.querySelector('#calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } else if (state.cabins.length > 0) {
      await selectCabin(state.cabins[0].id);
    }
  }

  /**
   * Быстрый поиск свободных домиков
   */
  async function performQuickSearch() {
    var checkIn = els.quickCheckIn ? els.quickCheckIn.value : null;
    var checkOut = els.quickCheckOut ? els.quickCheckOut.value : null;
    var guests = els.quickGuests ? parseInt(els.quickGuests.value, 10) : 2;
    var houseId = els.quickHouse ? els.quickHouse.value : '';

    var filteredCabins = state.cabins;

    // Сначала фильтруем по вместимости и выбранному домику
    filteredCabins = filteredCabins.filter(function(c) {
      if (houseId && c.id !== houseId) return false;
      if (c.capacity < guests) return false;
      return true;
    });

    if (checkIn && checkOut) {
      if (els.btnQuickSearch) els.btnQuickSearch.textContent = 'Поиск...';
      try {
        var promises = filteredCabins.map(function(c) {
          return EcoApi.getAvailability(c.id, checkIn, checkOut);
        });
        var availabilities = await Promise.all(promises);
        
        filteredCabins = filteredCabins.filter(function(c, i) {
          var avail = availabilities[i];
          if (!avail || !avail.dates || avail.dates.length === 0) return false;
          // Проверяем, что все ночи с checkIn до checkOut (исключая checkOut саму ночь) доступны
          // Для простоты проверим, есть ли заблокированные даты (is_blocked = true) в диапазоне дат
          // Или просто доверимся getPrices/getAvailability (он не возвращает даты, которые заняты, но getAvailability возвращает status)
          // Подождите, getAvailability возвращает массив dates с available = true/false
          // Давайте проверим все dates (кроме выезда, так как он не ночует в день выезда)
          var checkOutDate = new Date(checkOut);
          var allAvailable = true;
          for (var d = 0; d < avail.dates.length; d++) {
             var dateObj = new Date(avail.dates[d].date);
             if (dateObj >= checkOutDate) continue;
             if (!avail.dates[d].available) {
               allAvailable = false;
               break;
             }
          }
          return allAvailable;
        });
      } catch (err) {
        console.error('Ошибка при поиске доступности', err);
      } finally {
        if (els.btnQuickSearch) els.btnQuickSearch.textContent = 'Найти свободные даты';
      }
    }

    if (els.housesSearchResult) {
      els.housesSearchResult.style.display = 'block';
      if (filteredCabins.length > 0) {
        var text = `Найдено ${filteredCabins.length} вариантов для ${guests} гостей` + (checkIn && checkOut ? ` с ${EcoApi.formatDateShort(checkIn)} по ${EcoApi.formatDateShort(checkOut)}.` : '.');
        text += ' Пролистайте ниже и выберите подходящий домик из предложенных вариантов.';
        els.housesSearchText.textContent = text;
      } else {
        els.housesSearchText.textContent = `К сожалению, по вашим параметрам не найдено свободных домиков. Попробуйте изменить даты поиска или количество гостей.`;
      }
    }

    // Перерисовываем сетку
    if (els.housesGrid) {
      els.housesGrid.innerHTML = '';
      if (filteredCabins.length === 0) {
        els.housesGrid.innerHTML = '<p style="grid-column: 1/-1; color: var(--muted);">Нет свободных вариантов.</p>';
      } else {
        filteredCabins.forEach(function (cabin, index) {
          var mainImg = (cabin.images && cabin.images.length > 0) 
            ? cabin.images.find(img => img.category === 'main') || cabin.images[0] 
            : null;
          var imageStyle = mainImg && mainImg.url ? `--img: url('${mainImg.url}');` : '';

          var article = document.createElement('article');
          article.className = 'house-card';
          article.innerHTML = `
            <div class="house-image" style="${imageStyle}"></div>
            <div class="house-content">
              <span class="house-num">${String(index + 1).padStart(2, '0')}</span>
              <h3>${cabin.name}</h3>
              <p>${cabin.description || ''}</p>
              <div class="house-meta">
                <span class="chip">до ${cabin.capacity} гостей</span>
                <span class="chip">от ${EcoApi.formatPrice(cabin.base_price)}</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-primary select-cabin-btn" data-id="${cabin.id}" style="flex: 1;">Выбрать</button>
                <a href="/cabin.html?id=${cabin.id}" class="btn btn-ghost" style="flex: 1; min-height: 48px; border: 1px solid var(--line); border-radius: 6px; display: flex; align-items: center; justify-content: center; text-decoration: none;">Подробно</a>
              </div>
            </div>
          `;
          els.housesGrid.appendChild(article);
        });

        // Обработчики кнопок "Выбрать"
        document.querySelectorAll('.select-cabin-btn').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            var cid = e.target.getAttribute('data-id');
            selectCabin(cid);
            if (els.quickGuests) setCheckoutGuests(els.quickGuests.value);
            
            var quickIn = els.quickCheckIn ? els.quickCheckIn.value : null;
            var quickOut = els.quickCheckOut ? els.quickCheckOut.value : null;
            if (quickIn && quickOut && calendar) {
               if (typeof calendar.setSelection === 'function') {
                 calendar.setSelection(quickIn, quickOut);
               }
            }

            document.querySelector('#calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
      }
    }

    // Скроллим к результатам
    var housesSection = document.querySelector('#houses');
    if (housesSection) {
      housesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function getGuestsLabel(count) {
    count = parseInt(count, 10) || 2;
    if (count === 1) return '1 гость';
    if (count >= 2 && count <= 4) return count + ' гостя';
    return count + ' гостей';
  }

  function getSelectedCabin() {
    return state.cabins.find(function(c) { return c.id === state.selectedCabinId; }) || null;
  }

  function getSelectedCabinCapacity() {
    var cabin = getSelectedCabin();
    return cabin ? Math.max(1, parseInt(cabin.capacity, 10) || 1) : 6;
  }

  function setCheckoutGuests(count) {
    var maxGuests = getSelectedCabinCapacity();
    count = Math.max(1, Math.min(maxGuests, parseInt(count, 10) || 2));
    if (els.checkoutGuests) els.checkoutGuests.value = String(count);
    var label = document.getElementById('checkoutGuestsLabel');
    if (label) label.textContent = getGuestsLabel(count);
    var guestsControl = document.getElementById('checkoutGuestsControl');
    if (guestsControl) {
      guestsControl.setAttribute('data-max-guests', String(maxGuests));
      guestsControl.setAttribute('title', 'Вместимость выбранного домика: ' + getGuestsLabel(maxGuests));
      var decreaseBtn = guestsControl.querySelector('[data-action="decrease"]');
      var increaseBtn = guestsControl.querySelector('[data-action="increase"]');
      if (decreaseBtn) decreaseBtn.disabled = count <= 1;
      if (increaseBtn) increaseBtn.disabled = count >= maxGuests;
    }
  }

  function resetQuickSearch() {
    if (els.quickCheckIn) els.quickCheckIn.value = '';
    if (els.quickCheckOut) els.quickCheckOut.value = '';
    if (els.quickHouse) els.quickHouse.value = '';
    if (els.quickGuests) els.quickGuests.value = '2';
    if (els.housesSearchResult) els.housesSearchResult.style.display = 'none';
    renderCabins();
  }

  /**
   * Отрисовка дополнительных услуг
   */
  function renderExtraServices() {
    if (!els.extrasContainer) return;

    els.extrasContainer.innerHTML = '';

    var availableServices = state.extraServices.filter(function(service) {
      return service.is_active !== false && service.status !== 'Скрыта' && service.status !== 'hidden';
    });

    if (availableServices.length === 0) {
      els.extrasContainer.innerHTML = '<p style="color: var(--muted-2); font-size: 13px;">Дополнительные услуги пока не добавлены</p>';
      return;
    }

    availableServices.forEach(function (service) {
      var label = document.createElement('label');
      label.className = 'extra-chip';
      
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'extra-checkbox';
      input.value = service.price;
      input.dataset.id = service.id;
      
      input.addEventListener('change', updateCheckoutSummary);

      var text = document.createTextNode(' ' + service.name + ' · ' + EcoApi.formatPrice(service.price));
      
      label.appendChild(input);
      label.appendChild(text);
      
      els.extrasContainer.appendChild(label);
    });
  }

  /**
   * Инициализация
   */
  async function init() {
    try {
      setAppLoading('(Проверяем цены и календарь, подождите)', 'Загружаем данные');
      if (els.calTitle) els.calTitle.textContent = 'Загрузка...';

    // Максимальный дедлайн загрузки: если данные не пришли за 7 секунд — показываем страницу
    var loadingDeadline = setTimeout(function() {
      console.warn('[main] Дедлайн загрузки: показываем страницу без полных данных');
      hideAppLoading();
    }, 7000);

    // Загружаем данные с API параллельно. Каждый запрос имеет запасной результат,
    // чтобы страница не зависала, если Supabase долго не отвечает.
    var results = await Promise.all([
      safeLoad('домики', EcoApi.getCabins(), []),
      safeLoad('дополнительные услуги', EcoApi.getExtraServices(), []),
      safeLoad('настройки', EcoApi.getSettings(), state.settings),
      safeLoad('наполнение домов', EcoApi.getAmenities(), {}),
      safeLoad('главный экран', fetchJsonWithTimeout('/api/mainpage', 6000), {}),
      safeLoad('теги', fetchJsonWithTimeout('/api/tags', 6000), {}),
      safeLoad('теги домиков', fetchJsonWithTimeout('/api/cabin-tags', 6000), {})
    ]);

    clearTimeout(loadingDeadline);

    state.cabins = Array.isArray(results[0]) ? results[0] : [];
    state.extraServices = Array.isArray(results[1]) ? results[1] : [];
    state.settings = results[2] || state.settings;
    state.amenities = results[3] || {};
    state.mainpage = results[4].data || {};
    state.tags = results[5].data || [];
    state.cabinTags = results[6] || {};

    const statCabinsCount = document.getElementById('stat-cabins-count');
    if (statCabinsCount) {
      statCabinsCount.textContent = state.cabins.length;
    }

    applyMainpageSettings();
    renderTagsFilter();

    // Обновляем текст заезда/выезда на странице
    var checkoutInfoEl = document.getElementById('checkout-time-info');
    if (checkoutInfoEl) {
      checkoutInfoEl.textContent = 'Заезд с ' + state.settings.checkInTime + ', выезд до ' + state.settings.checkOutTime + ' (МСК). Выберите услуги — сумма обновится автоматически.';
    }

    // Инициализация календаря
    if (window.EcoCalendar && els.calGrid) {
      calendar = new window.EcoCalendar({
        gridEl: els.calGrid,
        titleEl: els.calTitle,
        subtitleEl: els.calSubtitle,
        prevBtn: els.calPrev,
        nextBtn: els.calNext,
        onSelectionChange: function (checkIn, checkOut, selectedDates) {
          state.selectedDates = selectedDates || [];
          updateCheckoutSummary();
          
          if (els.quickCheckIn) els.quickCheckIn.value = checkIn || '';
          if (els.quickCheckOut) els.quickCheckOut.value = checkOut || '';
        }
      });
    }

    await renderCabins();
    renderExtraServices();

    if (els.btnQuickSearch) {
      els.btnQuickSearch.addEventListener('click', performQuickSearch);
    }
    if (els.btnResetSearch) {
      els.btnResetSearch.addEventListener('click', resetQuickSearch);
    }
    
    // Ограничение даты выезда
    if (els.quickCheckIn && els.quickCheckOut) {
      var todayStr = window.EcoApi ? window.EcoApi.toDateString(new Date()) : new Date().toISOString().split('T')[0];
      els.quickCheckIn.min = todayStr;
      
      els.quickCheckIn.addEventListener('change', function() {
        if (els.quickCheckIn.value) {
          var checkInDate = new Date(els.quickCheckIn.value + 'T00:00:00');
          checkInDate.setDate(checkInDate.getDate() + 1);
          var nextDayStr = checkInDate.toISOString().split('T')[0];
          els.quickCheckOut.min = nextDayStr;
          
          if (els.quickCheckOut.value && els.quickCheckOut.value < nextDayStr) {
            els.quickCheckOut.value = nextDayStr;
          }
        } else {
          els.quickCheckOut.min = todayStr;
        }
      });
    }

    if (els.checkoutGuests) {
      setCheckoutGuests(els.checkoutGuests.value || (els.quickGuests ? els.quickGuests.value : 2));
    }
    var guestsControl = document.getElementById('checkoutGuestsControl');
    if (guestsControl) {
      guestsControl.addEventListener('click', function(e) {
        var btn = e.target.closest('.guest-stepper-btn');
        if (!btn || !els.checkoutGuests) return;
        var next = parseInt(els.checkoutGuests.value, 10) || 2;
        next += btn.dataset.action === 'increase' ? 1 : -1;
        setCheckoutGuests(next);
      });
    }

    // Включаем кнопку отправки только если введены имя и телефон
    const btnSubmit = document.getElementById('submitBookingBtn');
    const guestNameInput = document.getElementById('guestName');
    const guestPhoneInput = document.getElementById('guestPhone');

    function checkFormValidity() {
      if (btnSubmit && guestNameInput && guestPhoneInput) {
        if (guestNameInput.value.trim() && guestPhoneInput.value.trim()) {
          btnSubmit.disabled = false;
        } else {
          btnSubmit.disabled = true;
        }
      }
    }

    if (guestNameInput) guestNameInput.addEventListener('input', checkFormValidity);
    if (guestPhoneInput) guestPhoneInput.addEventListener('input', checkFormValidity);
    
    // Инициализируем начальное состояние
    checkFormValidity();

    // Обработка отправки формы бронирования
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!state.currentCalc) {
          window.showToast('Пожалуйста, выберите даты в календаре', 'error');
          return;
        }

        var selectedCabinForSubmit = getSelectedCabin();
        var guestsForSubmit = els.checkoutGuests ? (parseInt(els.checkoutGuests.value, 10) || 2) : 2;
        var maxGuestsForSubmit = selectedCabinForSubmit ? (parseInt(selectedCabinForSubmit.capacity, 10) || 1) : 6;
        if (selectedCabinForSubmit && guestsForSubmit > maxGuestsForSubmit) {
          setCheckoutGuests(maxGuestsForSubmit);
          window.showToast('В выбранном домике максимум ' + getGuestsLabel(maxGuestsForSubmit), 'error');
          return;
        }

        const btn = document.getElementById('submitBookingBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Отправка...';
        btn.disabled = true;

        var checkboxes = document.querySelectorAll('.extra-checkbox');
        var selectedExtras = [];
        checkboxes.forEach(function (cb) {
          if (cb.checked) {
            selectedExtras.push(cb.dataset.id);
          }
        });

        // Даты
        var sortedDates = [...state.selectedDates].sort((a,b) => a.date.localeCompare(b.date));
        var check_in = sortedDates[0].date;
        var check_out = sortedDates[sortedDates.length - 1].date;
        var outDate = new Date(check_out);
        outDate.setDate(outDate.getDate() + 1);
        check_out = outDate.toISOString().split('T')[0];

        var commentField = document.getElementById('guestComment').value;
        var guestCount = els.checkoutGuests ? els.checkoutGuests.value : 2;
        var finalComment = `Количество гостей: ${guestCount}` + (commentField ? `\nКомментарий: ${commentField}` : '');

        const payload = {
          cabin_id: state.selectedCabinId,
          check_in: check_in,
          check_out: check_out,
          guest_name: document.getElementById('guestName').value,
          guest_phone: document.getElementById('guestPhone').value,
          guest_telegram: document.getElementById('guestTelegram').value,
          guests_count: Number(guestCount) || 2,
          comment: finalComment,
          total_price: state.currentCalc ? state.currentCalc.total_price : 0,
          extras: selectedExtras,
          chat_token: localStorage.getItem('eco_chat_token')
        };

        try {
          const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            sessionStorage.setItem('lastBooking', JSON.stringify(data.data));
            sessionStorage.setItem('lastBookingPayload', JSON.stringify(payload));
            window.location.href = `/success.html`;
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          console.error(err);
          window.showToast(err.message || 'Произошла ошибка при отправке заявки', 'error');
        } finally {
          btn.textContent = originalText;
          btn.disabled = false;
        }
      });
    }

      if (state.cabins.length === 0) {
        showAppLoadingError('Домики не загрузились из базы. Если Supabase сейчас недоступен, страница не будет показывать демо-версию. Проверьте подключение и нажмите «Повторить загрузку».');
      } else {
        hideAppLoading();
      }
    } catch (err) {
      console.error('[main] Ошибка инициализации:', err);
      showAppLoadingError('Произошла ошибка загрузки: ' + err.message);
    }
  }


  function setOptionalText(id, value, fallback) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = String(value || '').trim();
    el.textContent = text || fallback;
  }

  function getDefaultMainpageFeatures() {
    return [
      { title: 'Преимущество 1', subtitle: 'Здесь администратор заполняет название, описание и фото первого преимущества.', image_url: '', placeholder: true },
      { title: 'Преимущество 2', subtitle: 'Здесь выводится второй пункт из блока «Почему здесь хорошо».', image_url: '', placeholder: true },
      { title: 'Преимущество 3', subtitle: 'Здесь выводится третий пункт: текст и изображение из админки.', image_url: '', placeholder: true },
      { title: 'Преимущество 4', subtitle: 'Здесь выводится четвертый пункт преимуществ на главной странице.', image_url: '', placeholder: true }
    ];
  }

  function renderMainpageFeatures(features) {
    const fgrid = document.getElementById('features-grid');
    const container = document.getElementById('features-main-image');
    const realFeatures = Array.isArray(features)
      ? features.filter(function(f) { return f && (f.title || f.subtitle || f.image_url); }).slice(0, 4)
      : [];
    const list = realFeatures.length ? realFeatures : getDefaultMainpageFeatures();

    if (fgrid) {
      fgrid.innerHTML = list.map(function(f, index) {
        const hasImage = !!f.image_url;
        const icon = hasImage
          ? '<div style="background-image:url(\'' + mainpageEscapeHtml(f.image_url) + '\');background-size:cover;background-position:center;border-radius:50%;width:48px;height:48px;margin-bottom:16px;"></div>'
          : '<div>' + (index + 1) + '</div>';
        return '<div class="feature-item' + (f.placeholder ? ' review-placeholder' : '') + '">' +
          icon +
          '<h3>' + mainpageEscapeHtml(f.title || ('Преимущество ' + (index + 1))) + '</h3>' +
          '<p>' + mainpageEscapeHtml(f.subtitle || 'Здесь администратор заполняет описание преимущества.') + '</p>' +
        '</div>';
      }).join('');
    }

    const featureImages = realFeatures.map(function(f) { return f.image_url; }).filter(Boolean);
    if (container) {
      container.innerHTML = '';
      if (!featureImages.length) {
        container.style.backgroundImage = 'none';
        container.innerHTML = '<div style="height:100%;min-height:260px;display:grid;place-items:center;text-align:center;padding:24px;color:var(--muted);border:1px dashed var(--line);border-radius:12px;background:rgba(237,228,214,.025);">Здесь будет главное фото или слайдшоу из изображений преимуществ.</div>';
        return;
      }
      featureImages.forEach(function(img, i) {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.top = '0';
        div.style.left = '0';
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.backgroundImage = "url('" + img + "')";
        div.style.backgroundSize = 'cover';
        div.style.backgroundPosition = 'center';
        div.style.transition = 'opacity 1s ease-in-out';
        div.style.opacity = i === 0 ? '1' : '0';
        div.style.borderRadius = 'inherit';
        container.appendChild(div);
      });
      if (featureImages.length > 1) {
        if (window.featuresSlideInterval) clearInterval(window.featuresSlideInterval);
        let currentIdx = 0;
        window.featuresSlideInterval = setInterval(function() {
          container.children[currentIdx].style.opacity = '0';
          currentIdx = (currentIdx + 1) % featureImages.length;
          container.children[currentIdx].style.opacity = '1';
        }, 4000);
      }
    }
  }

  function getDefaultTerritoryText() {
    return {
      title: 'Заголовок блока территории',
      desc: 'Здесь администратор описывает территорию: лес, озеро, приватность, расстояния между домиками и зоны отдыха.',
      side_title: 'Заголовок правого блока',
      items: [
        { title: 'Пункт правого блока 1', desc: 'Эти три пункта выводятся в блоке «Что рядом» на главной странице.' },
        { title: 'Пункт правого блока 2', desc: 'Здесь администратор заполняет название и описание второго пункта.' },
        { title: 'Пункт правого блока 3', desc: 'Здесь администратор заполняет название и описание третьего пункта.' }
      ]
    };
  }
  // --- Главная страница (CMS) ---
  function applyMainpageSettings() {
    const data = state.mainpage;
    if (!data || Object.keys(data).length === 0) return;

    // Глобальный фон
    if (data.global_bg_url) {
      const globalBg = document.getElementById('global-bg');
      if (globalBg) {
        globalBg.style.backgroundImage = `url('${data.global_bg_url}')`;
        globalBg.style.filter = 'sepia(0.4) brightness(0.4) contrast(1.1)';
        globalBg.style.opacity = '0.35';
      }
    }

    // Логотип
    if (data.logo) {
      const logoEl = document.getElementById('main-logo-img');
      const footerLogoEl = document.getElementById('footer-brand-mark');
      if (logoEl) {
        if (data.logo.url) {
          const imgHtml = `<img src="${data.logo.url}" style="width: 100%; height: 100%; object-fit: contain;">`;
          logoEl.innerHTML = imgHtml;
          logoEl.style.display = 'flex';
          logoEl.style.background = 'none';
          logoEl.style.border = 'none';
          logoEl.style.borderRadius = '0';
          if (footerLogoEl) {
            footerLogoEl.innerHTML = imgHtml;
            footerLogoEl.style.display = 'flex';
            footerLogoEl.style.background = 'none';
            footerLogoEl.style.border = 'none';
            footerLogoEl.style.borderRadius = '0';
          }
        } else {
          logoEl.style.display = 'none';
          if (footerLogoEl) {
            footerLogoEl.style.display = 'none';
          }
        }
      }
      if (data.logo.text) {
        const textEl = document.getElementById('main-logo-text');
        const footerTextEl = document.getElementById('footer-brand-name');
        if (textEl) textEl.textContent = data.logo.text;
        if (footerTextEl) footerTextEl.textContent = data.logo.text;
        const topMetaEl = document.getElementById('top-meta-hostname');
        if (topMetaEl) topMetaEl.textContent = data.logo.text;
      }
    }

    // Hero
    if (data.hero) {
      setOptionalText('hero-title', data.hero.title, 'Заголовок главного экрана');
      if (data.hero.background_url) {
        const heroSection = document.getElementById('hero-section');
        heroSection.style.backgroundImage = `linear-gradient(rgba(18, 15, 13, 0.35), rgba(18, 15, 13, 0.55)), url('${data.hero.background_url}')`;
        heroSection.style.backgroundSize = 'cover';
        heroSection.style.backgroundPosition = 'center';
        heroSection.style.backgroundRepeat = 'no-repeat';
      }
      
      const heroDescEl = document.getElementById('hero-desc');
      if (heroDescEl) {
        let suffixText = data.hero.desc;
        if (!suffixText) {
          heroDescEl.textContent = 'Здесь администратор заполняет описание главного экрана: формат отдыха, главные преимущества и атмосферу места.';
        } else {
          let prefixText = (data.logo && data.logo.text) ? data.logo.text : 'Название из админки';
          suffixText = suffixText.replace(/^[—\-\s]+/, '');
          heroDescEl.textContent = `${prefixText} — ${suffixText}`;
        }
      }
    }
    if (data.marquee && data.marquee.text) {
      document.getElementById('hero-kicker').textContent = data.marquee.text;
      const marqStr = (data.marquee.text + ' · ').repeat(5);
      const marqueeContainer = document.getElementById('marquee-container');
      if (marqueeContainer) {
        marqueeContainer.innerHTML = `<span>${marqStr}</span><span>${marqStr}</span><span>${marqStr}</span>`;
      }
    }

    // О месте
    if (data.about) {
      setOptionalText('about-title', data.about.title, 'Заголовок блока «О месте»');
      
      const aboutDescEl = document.getElementById('about-desc');
      if (aboutDescEl) {
        let suffixText = data.about.desc;
        if (!suffixText) {
          aboutDescEl.textContent = 'Здесь администратор заполняет текст о месте: что находится рядом, какой формат отдыха, чем территория отличается от обычной базы.';
        } else {
          let prefixText = (data.logo && data.logo.text) ? data.logo.text : 'Название из админки';
          suffixText = suffixText.replace(/^[—\-\s]+/, '');
          aboutDescEl.textContent = `${prefixText} — ${suffixText}`;
        }
      }
      
      const videoSection = document.getElementById('about-video-section');
      const videoPanel = videoSection ? videoSection.querySelector('.video-panel') : null;
      if (videoPanel) {
        // Убираем старое видео
        const oldMedia = videoPanel.querySelector('iframe, video, div[style*="rgba(29, 23, 18"]');
        if (oldMedia) {
            videoPanel.querySelectorAll('iframe, video, div[style*="rgba(29, 23, 18"]').forEach(e => e.remove());
        }

        const playBtn = document.getElementById('playVideoBtn');

        if (!data.about.video_file_url && !data.about.video_url) {
          // Если видео вообще нет, не показываем старую демо-картинку из верстки.
          videoPanel.style.backgroundImage = 'none';
          videoPanel.style.backgroundSize = '';
          videoPanel.style.backgroundPosition = '';
          if (playBtn) playBtn.style.display = 'none';
        } else {
          videoPanel.style.backgroundImage = 'none';
          
          if (data.about.video_autoplay) {
            if (playBtn) playBtn.style.display = 'none';
            videoPanel.style.position = 'relative';
            videoPanel.style.overflow = 'hidden';

            if (data.about.video_file_url) {
              const vid = document.createElement('video');
              vid.src = data.about.video_file_url;
              vid.autoplay = true;
              vid.loop = true;
              vid.muted = true;
              vid.playsInline = true;
              // Важно для iOS и многих браузеров:
              vid.setAttribute('muted', '');
              vid.setAttribute('playsinline', '');
              vid.setAttribute('autoplay', '');
              vid.setAttribute('controls', ''); // Временно для отладки
              vid.style.width = '100%';
              vid.style.height = '100%';
              vid.style.objectFit = 'cover';
              vid.style.position = 'absolute';
              vid.style.top = '0';
              vid.style.left = '0';
              vid.style.display = 'block';
              vid.style.border = 'none';
              vid.style.zIndex = '0';
              vid.style.pointerEvents = 'none';
              
              // Темный фильтр поверх видео
              const overlay = document.createElement('div');
              overlay.style.position = 'absolute';
              overlay.style.inset = '0';
              overlay.style.background = 'rgba(29, 23, 18, 0.4)';
              overlay.style.zIndex = '1';
              
              // Логика обрезки по времени
              let vStart = parseFloat(data.about.video_start) || 0;
              let vEnd = parseFloat(data.about.video_end) || 0;
              if (vStart > 0 || vEnd > 0) {
                 vid.addEventListener('timeupdate', () => {
                   if (vEnd > 0 && vid.currentTime >= vEnd) {
                     vid.currentTime = vStart;
                   }
                 });
                 vid.addEventListener('loadedmetadata', () => {
                   if (vStart > 0) vid.currentTime = vStart;
                 });
              }
              videoPanel.appendChild(vid);
              videoPanel.appendChild(overlay);
              vid.load();
              vid.play().catch(e => console.error("Video autoplay blocked:", e));
            } else if (data.about.video_url) {
              let vUrl = data.about.video_url;
              const iframeMatch = vUrl.match(/src=["'](.*?)["']/);
              if (iframeMatch && iframeMatch[1]) vUrl = iframeMatch[1];

              const ytMatch = vUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
              const ytId = (ytMatch && ytMatch[2].length === 11) ? ytMatch[2] : null;
              
              const vkMatch = vUrl.match(/(?:vkvideo\.ru|vk\.com)\/video([-0-9]+)_([0-9]+)/);
              
              let finalUrl = vUrl;
              if (ytId) {
                 finalUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&mute=1&playlist=${ytId}&controls=0&disablekb=1&modestbranding=1`;
                 if (data.about.video_start) finalUrl += `&start=${data.about.video_start}`;
                 if (data.about.video_end) finalUrl += `&end=${data.about.video_end}`;
              } else if (vkMatch) {
                 finalUrl = `https://vk.com/video_ext.php?oid=${vkMatch[1]}&id=${vkMatch[2]}&autoplay=1&loop=1&muted=1`;
                 if (data.about.video_start) finalUrl += `&t=${data.about.video_start}`;
              } else {
                 finalUrl += (vUrl.includes('?') ? '&' : '?') + 'autoplay=1&loop=1&mute=1&muted=1';
                 if (data.about.video_start) finalUrl += `&t=${data.about.video_start}`;
              }

              const iframe = document.createElement('iframe');
              iframe.src = finalUrl;
              iframe.style.width = '100%';
              iframe.style.height = '100%';
              iframe.style.position = 'absolute';
              iframe.style.top = '0';
              iframe.style.left = '0';
              iframe.style.zIndex = '0';
              iframe.style.pointerEvents = 'none'; // Запрещаем клики
              iframe.frameBorder = '0';
              iframe.allow = 'autoplay; fullscreen; picture-in-picture';
              
              const overlay = document.createElement('div');
              overlay.style.position = 'absolute';
              overlay.style.inset = '0';
              overlay.style.background = 'rgba(29, 23, 18, 0.4)';
              overlay.style.zIndex = '1';

              videoPanel.appendChild(iframe);
              videoPanel.appendChild(overlay);
            }
          } else {
            if (playBtn) playBtn.style.display = '';
          }
        }
      }
    }

    // Почему здесь хорошо
    const featuresMeta = data.features_meta || {};
    setOptionalText('features-label', featuresMeta.label, 'Маленькая подпись блока преимуществ');
    setOptionalText('features-title', featuresMeta.title, 'Заголовок блока преимуществ');
    renderMainpageFeatures(data.features);

    // Территория
    applyTerritoryText(data.territory);
    if (data.territory && data.territory.background_url) {
      document.getElementById('territory-stage').style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${data.territory.background_url}')`;
      document.getElementById('territory-stage').style.backgroundSize = 'cover';
      document.getElementById('territory-stage').style.backgroundPosition = 'center';
    }

    // Контакты
    const reviewsMeta = data.reviews_meta || {};
    setOptionalText('reviews-label', reviewsMeta.label, 'Маленькая подпись блока отзывов');
    setOptionalText('reviews-title', reviewsMeta.title, 'Заголовок блока отзывов');
    renderMainpageReviews(data.reviews);

    const contacts = data.contacts || {};
    setOptionalText('contact-section-label', contacts.label, 'Маленькая подпись контактного блока');
    setOptionalText('contact-title', contacts.title, 'Заголовок контактного блока');
    setOptionalText('contact-desc', contacts.desc, 'Здесь администратор заполняет короткое описание контактного блока.');
    setOptionalText('contact-cta-link', contacts.cta_text, 'Текст кнопки заявки из админки');

    const contactPhoneLink = document.getElementById('contact-phone-link');
    if (contactPhoneLink) {
      if (contacts.phone) {
        contactPhoneLink.href = 'tel:' + contacts.phone;
        contactPhoneLink.textContent = contacts.phone;
      } else {
        contactPhoneLink.removeAttribute('href');
        contactPhoneLink.textContent = 'Телефон из блока контактов';
      }
    }

    const contactEmailLink = document.getElementById('contact-email-link');
    if (contactEmailLink) {
      if (contacts.email) {
        contactEmailLink.href = 'mailto:' + contacts.email;
        contactEmailLink.textContent = contacts.email;
      } else {
        contactEmailLink.removeAttribute('href');
        contactEmailLink.textContent = 'Email из блока контактов';
      }
    }

    const footerContact = document.getElementById('footer-contact-info');
    if (footerContact) {
      const contactLines = [];
      if (contacts.phone) contactLines.push(contacts.phone);
      if (contacts.email) contactLines.push(contacts.email);
      footerContact.innerHTML = contactLines.length ? contactLines.join('<br>') : 'Телефон и email заполняются администратором';
    }

    if (contacts.background_url) {
      const ctaCard = document.getElementById('contact-bg-card');
      if (ctaCard) {
        ctaCard.style.backgroundImage = "linear-gradient(180deg, rgba(18,15,13,.18), rgba(18,15,13,.86)), url('" + contacts.background_url + "')";
      }
    }

    const mapc = document.getElementById('contact-map-container');
    if (mapc) {
      if (contacts.map_code && contacts.map_code.includes(',')) {
        mapc.style.display = 'block';
        mapc.innerHTML = '';

        if (typeof ymaps !== 'undefined') {
          ymaps.ready(() => {
            const coords = contacts.map_code.split(',').map(Number);
            const myMap = new ymaps.Map(mapc, {
              center: coords,
              zoom: 14,
              controls: ['zoomControl', 'fullscreenControl']
            });

            const placemark = new ymaps.Placemark(coords, {
              balloonContent: 'Мы здесь!'
            }, {
              preset: 'islands#redIcon'
            });
            myMap.geoObjects.add(placemark);
            myMap.behaviors.disable('scrollZoom');
          });
        }
      } else {
        mapc.style.display = 'none';
      }
    }
  }

  function applyTerritoryText(territory) {
    const fallback = getDefaultTerritoryText();
    const source = territory || {};
    setOptionalText('territory-title', source.title, fallback.title);
    setOptionalText('territory-desc', source.desc, fallback.desc);
    setOptionalText('territory-side-title', source.side_title, fallback.side_title);
    const items = Array.isArray(source.items) ? source.items : [];
    for (let i = 0; i < 3; i++) {
      const item = items[i] || {};
      const fallbackItem = fallback.items[i] || {};
      setOptionalText('territory-item-title-' + i, item.title, fallbackItem.title || ('Пункт правого блока ' + (i + 1)));
      setOptionalText('territory-item-desc-' + i, item.desc, fallbackItem.desc || 'Здесь администратор заполняет описание пункта.');
    }
  }


  function getDefaultMainpageReviews() {
    return [
      { rating: 0, text: 'Здесь администратор добавит текст отзыва гостя. Вставьте реальный отзыв из Яндекс Отзывов или другого источника в панели управления.', author: 'Имя', source: 'Источник отзыва', placeholder: true },
      { rating: 0, text: 'Добавьте второй отзыв в разделе «Главный экран». На сайте можно показать до трёх аккуратных карточек.', author: 'Имя', source: 'Источник отзыва', placeholder: true },
      { rating: 0, text: 'Добавьте третий отзыв, если нужно. Если отзывов меньше трёх, оставшиеся места будут подсказками для администратора.', author: 'Имя', source: 'Источник отзыва', placeholder: true }
    ];
  }

  function mainpageEscapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function renderMainpageReviews(reviews) {
    const grid = document.getElementById('reviews-grid') || document.querySelector('.reviews-grid');
    if (!grid) return;
    const realReviews = Array.isArray(reviews) ? reviews.filter(function(review) { return review && !review.placeholder && (review.text || review.author || review.source); }).slice(0, 3) : [];
    const list = realReviews.length ? realReviews : getDefaultMainpageReviews();
    grid.innerHTML = list.map(function(review) {
      const isPlaceholder = !!review.placeholder;
      const rating = Math.max(1, Math.min(5, parseInt(review.rating, 10) || 5));
      const author = mainpageEscapeHtml(review.author || 'Имя');
      const source = mainpageEscapeHtml(review.source || 'Источник отзыва');
      const text = mainpageEscapeHtml(review.text || '');
      const avatar = author ? author.slice(0, 1).toUpperCase() : 'И';
      const starsHtml = isPlaceholder
        ? '<div class="stars-outline" aria-label="Нет отзывов">★★★★★</div>'
        : '<div class="stars" aria-label="' + rating + ' из 5" style="--rating:' + rating + '"></div>';
      return '<article class="review' + (isPlaceholder ? ' review-placeholder' : '') + '">' +
        starsHtml +
        '<p>' + text + '</p>' +
        '<div class="person">' +
          '<div class="avatar">' + mainpageEscapeHtml(avatar) + '</div>' +
          '<div><b>' + author + '</b><span>' + source + '</span></div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  // --- Фильтры тегов ---
  function renderTagsFilter() {
    const filtersContainer = document.getElementById('cabins-filters');
    if (!filtersContainer) return;
    
    let html = `<span class="filter active" data-tag="all">Все</span>`;
    state.tags.forEach(t => {
      html += `<span class="filter" data-tag="${t}">${t}</span>`;
    });
    filtersContainer.innerHTML = html;

    filtersContainer.querySelectorAll('.filter').forEach(el => {
      el.addEventListener('click', (e) => {
        filtersContainer.querySelectorAll('.filter').forEach(f => f.classList.remove('active'));
        e.target.classList.add('active');
        state.currentTagFilter = e.target.dataset.tag;
        renderCabins(); // Перерендерим домики
      });
    });
  }

  // --- Видео Модалка ---
  const videoModal = document.getElementById('videoModal');
  const closeVideoBtn = document.getElementById('closeVideoBtn');
  const playVideoBtn = document.getElementById('playVideoBtn');
  const videoIframe = document.getElementById('videoIframe');

  function getYoutubeId(url) {
    var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  if (playVideoBtn && videoModal) {
    playVideoBtn.addEventListener('click', () => {
      let vUrl = state.mainpage?.about?.video_file_url || state.mainpage?.about?.video_url;
      if (!vUrl) {
        window.showToast('Видео не добавлено', 'info');
        return;
      }

      if (state.mainpage?.about?.video_file_url) {
        // Локальный файл в модалке
        videoIframe.style.display = 'none';
        let vid = document.getElementById('modalVideoFile');
        if (!vid) {
          vid = document.createElement('video');
          vid.id = 'modalVideoFile';
          vid.controls = true;
          vid.style.width = '100%';
          vid.style.height = '100%';
          vid.style.borderRadius = '12px';
          videoModal.querySelector('.video-container').appendChild(vid);
        }
        vid.style.display = 'block';
        vid.src = vUrl;
        
        if (state.mainpage?.about?.video_start > 0 || state.mainpage?.about?.video_end > 0) {
           const start = state.mainpage.about.video_start || 0;
           const end = state.mainpage.about.video_end || 0;
           vid.addEventListener('timeupdate', function timeHandler() {
             if (end > 0 && vid.currentTime >= end) {
               vid.currentTime = start;
             }
           });
           vid.currentTime = start;
        }
        
        vid.play();
        videoModal.classList.add('open');
      } else {
        // Ссылка в iframe
        const vid = document.getElementById('modalVideoFile');
        if (vid) { vid.pause(); vid.style.display = 'none'; }
        videoIframe.style.display = 'block';

        let vUrlLink = state.mainpage.about.video_url;
        const iframeMatch = vUrlLink.match(/src=["'](.*?)["']/);
        if (iframeMatch && iframeMatch[1]) {
          vUrlLink = iframeMatch[1];
        }

        let finalUrl = vUrlLink;
        const ytId = getYoutubeId(vUrlLink);
        if (ytId) {
          finalUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&mute=1&playlist=${ytId}`;
          if (state.mainpage?.about?.video_start) finalUrl += `&start=${state.mainpage.about.video_start}`;
          if (state.mainpage?.about?.video_end) finalUrl += `&end=${state.mainpage.about.video_end}`;
        } else {
          finalUrl += (vUrlLink.includes('?') ? '&' : '?') + 'autoplay=1&loop=1&mute=1&muted=1';
          if (state.mainpage?.about?.video_start) finalUrl += `&t=${state.mainpage.about.video_start}`;
        }
        
        videoIframe.src = finalUrl;
        videoModal.classList.add('open');
      }
    });

    closeVideoBtn.addEventListener('click', () => {
      videoModal.classList.remove('open');
      videoIframe.src = '';
      const vid = document.getElementById('modalVideoFile');
      if (vid) { vid.pause(); vid.src = ''; }
    });
  }

  // --- Галерея Модалка ---
  const galleryModal = document.getElementById('galleryModal');
  const galleryModalBody = document.getElementById('galleryModalBody');
  const galleryTabs = document.querySelectorAll('.gallery-tab');
  const closeGalleryBtn = document.getElementById('closeGalleryBtn');
  let currentGalleryImages = [];

  window.openGallery = function(cabinId) {
    const cabin = state.cabins.find(c => c.id == cabinId);
    if (!cabin) return;

    currentGalleryImages = cabin.images || [];
    if (currentGalleryImages.length === 0) {
      if (cabin.image_url) {
        currentGalleryImages = [{ url: cabin.image_url, category: 'main' }];
      } else {
        window.showToast('Фотографии отсутствуют', 'error');
        return;
      }
    }

    document.getElementById('galleryModalTitle').textContent = `Фотографии: ${cabin.name}`;
    
    // Сброс табов
    galleryTabs.forEach(t => t.classList.remove('active'));
    document.querySelector('.gallery-tab[data-tab="all"]').classList.add('active');

    renderGalleryImages('all');
    galleryModal.classList.add('open');
  };

  closeGalleryBtn.addEventListener('click', () => {
    galleryModal.classList.remove('open');
  });

  galleryTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      galleryTabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderGalleryImages(e.target.getAttribute('data-tab'));
    });
  });

  function renderGalleryImages(filterCategory) {
    galleryModalBody.innerHTML = '';
    const imagesToRender = filterCategory === 'all' 
      ? currentGalleryImages 
      : currentGalleryImages.filter(img => img.category === filterCategory);

    if (imagesToRender.length === 0) {
      galleryModalBody.innerHTML = '<p style="grid-column: 1/-1; color: var(--muted); text-align: center;">В этой категории пока нет фото</p>';
      return;
    }

    imagesToRender.forEach(img => {
      const item = document.createElement('div');
      item.className = 'gallery-modal-item';
      item.innerHTML = `
        <div class="blur-bg" style="background-image: url('${img.url}')"></div>
        <img src="${img.url}" loading="lazy" alt="Фото домика">
      `;
      galleryModalBody.appendChild(item);
    });
  }

  // Запуск
  init();

})();
