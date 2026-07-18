/**
 * Клиентский API-модуль eco-gorniy.ru
 * Предоставляет методы для взаимодействия с бэкендом.
 * Все методы возвращают данные из поля data ответа сервера.
 */

(function () {
  'use strict';

  // Автоматическая CSRF-защита всех изменяющих same-origin запросов админки,
  // включая исторические прямые вызовы fetch() вне EcoApi.
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var options = init ? Object.assign({}, init) : {};
    var method = String(options.method || 'GET').toUpperCase();
    var url = typeof input === 'string' ? input : input && input.url;
    var isSameOrigin = !url || url.charAt(0) === '/' || url.indexOf(window.location.origin) === 0;
    if (isSameOrigin && !/^(GET|HEAD|OPTIONS)$/.test(method)) {
      var match = document.cookie.match(/(?:^|;\s*)eco_admin_csrf=([^;]+)/);
      if (match) {
        var headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
        headers.set('X-CSRF-Token', decodeURIComponent(match[1]));
        options.headers = headers;
      }
    }
    return nativeFetch(input, options);
  };

  /**
   * Вспомогательная функция для тостов (уведомлений)
   */
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

  /**
   * Внутренний метод для выполнения GET-запросов к API.
   * Обрабатывает ошибки сети, HTTP-статусы и структуру ответа.
   */
  var REQUEST_TIMEOUT_MS = 30000;

  async function _request(url) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS) : null;

    try {
      var options = { cache: 'no-store' };
      if (controller) options.signal = controller.signal;
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorBody = await response.json().catch(function () {
          return { error: 'Неизвестная ошибка сервера' };
        });
        console.error('[EcoApi] Ошибка ' + response.status + ':', errorBody.error || response.statusText);
        return null;
      }

      const json = await response.json();

      if (!json.success) {
        console.error('[EcoApi] Сервер вернул ошибку:', json.error);
        return null;
      }

      return json.data;
    } catch (err) {
      var message = err.name === 'AbortError' ? 'request timeout' : err.message;
      console.error('[EcoApi] Ошибка сети при запросе ' + url + ':', message);
      return null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Формирует строку query-параметров из объекта.
   * Пропускает null, undefined и пустые строки.
   */
  function _buildQuery(params) {
    var parts = [];
    for (var key in params) {
      if (params.hasOwnProperty(key) && params[key] !== null && params[key] !== undefined && params[key] !== '') {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    return parts.length > 0 ? '?' + parts.join('&') : '';
  }

  /**
   * Форматирует число в строку цены: 12500 → "12 500 ₽"
   */
  function formatPrice(value) {
    if (value === null || value === undefined) {
      return '—';
    }
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  }

  /**
   * Форматирует дату YYYY-MM-DD в читаемый вид: "12 июля"
   */
  function formatDateShort(dateStr) {
    var months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    var parts = dateStr.split('-');
    var day = parseInt(parts[2], 10);
    var month = parseInt(parts[1], 10) - 1;
    return day + ' ' + months[month];
  }

  /**
   * Возвращает дату в формате YYYY-MM-DD из объекта Date.
   */
  function toDateString(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var EcoApi = {
    /**
     * Получить список всех активных домиков.
     * GET /api/cabins
     * Возвращает массив домиков или пустой массив при ошибке.
     */
    getCabins: async function () {
      var data = await _request('/api/cabins');
      return data || [];
    },

    /**
     * Получить один домик по slug.
     * GET /api/cabins/:slug
     * Возвращает объект домика или null при ошибке.
     */
    getCabin: async function (slug) {
      var data = await _request('/api/cabins/' + encodeURIComponent(slug));
      return data || null;
    },

    /**
     * Получить список активных дополнительных услуг.
     * GET /api/extra-services
     * Возвращает массив услуг или пустой массив при ошибке.
     */
    getExtraServices: async function () {
      var data = await _request('/api/extra-services');
      return data || [];
    },

    /**
     * Получить глобальные настройки
     */
    getSettings: async function () {
      var data = await _request('/api/settings');
      return data || { checkInTime: '16:00', checkOutTime: '14:00' };
    },

    /**
     * Получить доп. услуги для домиков (привязки)
     */
    getAmenities: async function () {
      var data = await _request('/api/amenities');
      return data || {};
    },

    /**
     * Получить календарь цен.
     * GET /api/prices?cabin_id=...&from=...&to=...
     * Все параметры необязательные.
     * Возвращает массив объектов цен или пустой массив.
     */
    getPrices: async function (cabinId, from, to) {
      var query = _buildQuery({ cabin_id: cabinId, from: from, to: to });
      var data = await _request('/api/prices' + query);
      return data || [];
    },

    /**
     * Получить доступность дат для домика.
     * GET /api/availability?cabin_id=...&from=...&to=...
     * cabin_id — обязательный.
     * Возвращает объект { cabin_id, cabin_name, dates: [...] } или null.
     */
    getAvailability: async function (cabinId, from, to) {
      if (!cabinId) {
        console.error('[EcoApi] getAvailability: cabin_id обязателен');
        return null;
      }
      var query = _buildQuery({ cabin_id: cabinId, from: from, to: to });
      var data = await _request('/api/availability' + query);
      return data || null;
    },

    /** Форматирование цены: 12500 → "12 500 ₽" */
    formatPrice: formatPrice,

    /** Форматирование даты: "2026-07-12" → "12 июля" */
    formatDateShort: formatDateShort,

    /** Date → "YYYY-MM-DD" */
    toDateString: toDateString,
    escapeHtml: escapeHtml,
    /**
     * Выполнить произвольный GET запрос
     */
    get: async function(url) {
      return await _request(url);
    },

    /**
     * Выполнить POST запрос
     */
    post: async function(url, body) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
           const err = await response.json().catch(() => ({}));
           throw new Error(err.error || response.statusText);
        }
        const json = await response.json();
        if (!json.success) throw new Error(json.error);
        return json.data || json;
      } catch (err) {
        console.error('[EcoApi] POST error:', err);
        throw err;
      }
    },

    /**
     * Выполнить PATCH запрос
     */
    patch: async function(url, body) {
      try {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) {
           const err = await response.json().catch(() => ({}));
           throw new Error(err.error || response.statusText);
        }
        const json = await response.json();
        if (!json.success) throw new Error(json.error);
        return json.data || json;
      } catch (err) {
        console.error('[EcoApi] PATCH error:', err);
        throw err;
      }
    },

    /**
     * Выполнить DELETE запрос
     */
    delete: async function(url) {
      try {
        const response = await fetch(url, {
          method: 'DELETE'
        });
        if (!response.ok) {
           const err = await response.json().catch(() => ({}));
           throw new Error(err.error || response.statusText);
        }
        const json = await response.json();
        if (!json.success) throw new Error(json.error);
        return json.data || json;
      } catch (err) {
        console.error('[EcoApi] DELETE error:', err);
        throw err;
      }
    }
  };

  window.EcoApi = EcoApi;

  // Глобальная система отслеживания несохраненных изменений
  window.hasUnsavedChanges = false;
  window.pendingNavigationUrl = null;

  window.addEventListener('beforeunload', function(e) {
    if (window.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  document.addEventListener('click', function(e) {
    if (!window.hasUnsavedChanges) return;

    var link = e.target.closest('a');
    if (!link && e.target.classList.contains('admin-menu-item')) link = e.target;
    
    if (link && link.href && !link.hasAttribute('data-bypass-warning')) {
      var urlObj = new URL(link.href, window.location.href);
      if (urlObj.pathname !== window.location.pathname) {
        e.preventDefault();
        e.stopPropagation();
        window.pendingNavigationUrl = link.href;
        window.showUnsavedWarningModal();
      }
    }
  }, true);

  window.showUnsavedWarningModal = function() {
    var existing = document.getElementById('unsavedWarningModal');
    if (existing) existing.remove();

    var modalHtml = `
      <div id="unsavedWarningModal" class="modal-overlay open" style="z-index: 99999; display: flex; align-items: center; justify-content: center;">
        <div class="modal-content" style="max-width: 400px; text-align: center; padding: 32px;">
          <h3 style="margin-top: 0; font-size: 20px;">Несохраненные изменения</h3>
          <p style="color: var(--muted); margin-bottom: 24px; font-size: 14px; line-height: 1.5;">Вы не сохранили внесенные данные. Если вы уйдете со страницы, они будут потеряны.</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn btn-secondary" id="stayOnPageBtn" style="flex: 1;">Отмена</button>
            <button class="btn" id="leavePageBtn" style="flex: 1; background: rgba(212,107,107,0.15); border-color: rgba(212,107,107,0.4); color: #f0c6b8;">ОК (Выйти)</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('stayOnPageBtn').onclick = function() {
      document.getElementById('unsavedWarningModal').remove();
      window.pendingNavigationUrl = null;
    };

    document.getElementById('leavePageBtn').onclick = function() {
      window.hasUnsavedChanges = false;
      if (window.pendingNavigationUrl) {
        window.location.href = window.pendingNavigationUrl;
      }
    };
  };

})();
