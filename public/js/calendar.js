/**
 * Модуль календаря eco-gorniy.ru
 * Интерактивный календарь с выбором диапазона дат,
 * отображением цен, промо-акций и занятых дат.
 * Данные загружаются из GET /api/availability.
 */

(function () {
  'use strict';

  var MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  var WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getMoscowNow() {
    var d = new Date();
    var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 3));
  }

  /**
   * Создаёт экземпляр календаря.
   * @param {Object} options
   * @param {HTMLElement} options.gridEl — контейнер для ячеек дат
   * @param {HTMLElement} options.titleEl — элемент заголовка (месяц/год)
   * @param {HTMLElement} options.subtitleEl — подзаголовок (название домика)
   * @param {HTMLElement} options.prevBtn — кнопка «назад»
   * @param {HTMLElement} options.nextBtn — кнопка «вперёд»
   * @param {Function} options.onSelectionChange — колбэк при изменении выделения
   */
  function EcoCalendar(options) {
    this.gridEl = options.gridEl;
    this.titleEl = options.titleEl;
    this.subtitleEl = options.subtitleEl;
    this.prevBtn = options.prevBtn;
    this.nextBtn = options.nextBtn;
    this.onSelectionChange = options.onSelectionChange || function () {};

    /* Текущий отображаемый месяц в МСК */
    var now = getMoscowNow();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();

    /* Выбранный домик */
    this.cabinId = null;
    this.cabinName = '';
    this.basePrice = 0;

    /* Данные доступности: карта дат */
    this.availabilityMap = {};

    /* Выделенный диапазон: checkIn и checkOut */
    this.checkIn = null;
    this.checkOut = null;

    /* Привязка обработчиков */
    var self = this;

    this.prevBtn.addEventListener('click', function () {
      self.prevMonth();
    });

    this.nextBtn.addEventListener('click', function () {
      self.nextMonth();
    });
  }

  /**
   * Устанавливает домик и загружает данные доступности.
   */
  EcoCalendar.prototype.setCabin = async function (cabinId, cabinName, basePrice) {
    this.cabinId = cabinId;
    this.cabinName = cabinName || '';
    this.basePrice = basePrice || 0;
    this.checkIn = null;
    this.checkOut = null;
    this.availabilityMap = {};

    await this.loadAvailability();
    this.render();
    this.notifySelectionChange();
  };

  /**
   * Загружает данные доступности с сервера.
   */
  EcoCalendar.prototype.loadAvailability = async function () {
    if (!this.cabinId) {
      return;
    }

    var today = new Date();
    var fromDate = window.EcoApi ? EcoApi.toDateString(today) : today.toISOString().split('T')[0];
    var futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 180);
    var toDate = window.EcoApi ? EcoApi.toDateString(futureDate) : futureDate.toISOString().split('T')[0];

    var result = await EcoApi.getAvailability(this.cabinId, fromDate, toDate);

    this.availabilityMap = {};

    if (result && result.dates) {
      for (var i = 0; i < result.dates.length; i++) {
        this.availabilityMap[result.dates[i].date] = result.dates[i];
      }
    }
  };

  /**
   * Переход к предыдущему месяцу.
   */
  EcoCalendar.prototype.prevMonth = function () {
    var now = getMoscowNow();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth();

    /* Не позволяем переходить раньше текущего месяца */
    if (this.currentYear === currentYear && this.currentMonth === currentMonth) {
      return;
    }

    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.render();
  };

  /**
   * Переход к следующему месяцу.
   */
  EcoCalendar.prototype.nextMonth = function () {
    /* Ограничиваем +6 месяцев вперёд */
    var now = getMoscowNow();
    var maxDate = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    var nextDate = new Date(this.currentYear, this.currentMonth + 1, 1);

    if (nextDate > maxDate) {
      return;
    }

    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.render();
  };

  /**
   * Обрабатывает клик по дате. Реализует выбор диапазона:
   * первый клик — checkIn, второй — checkOut.
   */
  EcoCalendar.prototype.isRangeAvailable = function (checkIn, checkOut) {
    if (!checkIn || !checkOut || checkOut <= checkIn) return false;

    var current = new Date(checkIn + 'T00:00:00');
    var end = new Date(checkOut + 'T00:00:00');

    /* Проверяем ночи [заезд, выезд), не включая дату выезда. */
    while (current < end) {
      var dateStr = EcoApi.toDateString(current);
      var dayData = this.availabilityMap[dateStr];
      if (!dayData || !dayData.available) return false;
      current.setDate(current.getDate() + 1);
    }

    return true;
  };

  EcoCalendar.prototype.handleDayClick = function (dateStr) {
    var dayData = this.availabilityMap[dateStr];
    var canUseAsCheckout = Boolean(
      this.checkIn &&
      !this.checkOut &&
      dateStr > this.checkIn &&
      this.isRangeAvailable(this.checkIn, dateStr)
    );

    /* Занятую ночь можно нажать только как дату выезда. */
    if (!dayData || (!dayData.available && !canUseAsCheckout)) {
      return;
    }

    var today = EcoApi.toDateString(getMoscowNow());
    if (dateStr < today) {
      return;
    }

    if (!this.checkIn || (this.checkIn && this.checkOut)) {
      /* Начинаем новый выбор */
      this.checkIn = dateStr;
      this.checkOut = null;
    } else {
      /* Устанавливаем checkOut */
      if (dateStr <= this.checkIn) {
        /* Если выбрали дату раньше checkIn — начинаем заново */
        this.checkIn = dateStr;
        this.checkOut = null;
      } else {
        var hasBlockedDate = !this.isRangeAvailable(this.checkIn, dateStr);

        if (hasBlockedDate) {
          /* Свободную дату можно использовать как начало нового выбора. */
          if (dayData.available) {
            this.checkIn = dateStr;
            this.checkOut = null;
          }
        } else {
          this.checkOut = dateStr;
        }
      }
    }

    this.render();
    this.notifySelectionChange();
  };

  /**
   * Собирает выделенные даты и вызывает колбэк.
   */
  EcoCalendar.prototype.notifySelectionChange = function () {
    var selectedDates = [];

    if (this.checkIn && this.checkOut) {
      var current = new Date(this.checkIn + 'T00:00:00');
      var end = new Date(this.checkOut + 'T00:00:00');

      /* Собираем даты от checkIn до checkOut (исключительно) */
      while (current < end) {
        var dateStr = EcoApi.toDateString(current);
        var dayData = this.availabilityMap[dateStr];
        selectedDates.push({
          date: dateStr,
          price: dayData ? dayData.price : this.basePrice,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    this.onSelectionChange(this.checkIn, this.checkOut, selectedDates);
  };

  /**
   * Отрисовывает календарь: заголовок, сетку дат.
   */
  EcoCalendar.prototype.render = function () {
    /* Заголовок */
    this.titleEl.textContent = MONTH_NAMES[this.currentMonth] + ' ' + this.currentYear;

    if (this.subtitleEl) {
      this.subtitleEl.textContent = this.cabinName
        ? this.cabinName + ' · цена за ночь'
        : 'Выберите домик';
    }

    /* Очищаем сетку */
    this.gridEl.innerHTML = '';

    /* Первый день месяца */
    var firstDay = new Date(this.currentYear, this.currentMonth, 1);
    /* День недели первого числа (0=Вс, 1=Пн...) → переводим в (0=Пн..6=Вс) */
    var startDay = (firstDay.getDay() + 6) % 7;
    /* Количество дней в месяце */
    var daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    var todayStr = EcoApi.toDateString(getMoscowNow());
    var self = this;

    /* Пустые ячейки до начала месяца */
    for (var e = 0; e < startDay; e++) {
      var emptyBtn = document.createElement('button');
      emptyBtn.type = 'button';
      emptyBtn.className = 'calendar-day empty';
      emptyBtn.innerHTML = '&nbsp;';
      this.gridEl.appendChild(emptyBtn);
    }

    /* Ячейки дней */
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = this.currentYear + '-' +
        String(this.currentMonth + 1).padStart(2, '0') + '-' +
        String(day).padStart(2, '0');

      var dayData = this.availabilityMap[dateStr];
      var isPast = dateStr < todayStr;
      var isBusy = dayData ? !dayData.available : false;
      var canBeCheckout = Boolean(
        !isPast &&
        isBusy &&
        this.checkIn &&
        !this.checkOut &&
        dateStr > this.checkIn &&
        this.isRangeAvailable(this.checkIn, dateStr)
      );
      var isCheckoutBoundary = canBeCheckout || Boolean(
        isBusy && this.checkOut && dateStr === this.checkOut
      );
      var isPromo = dayData ? dayData.is_promo : false;
      var price = dayData ? dayData.price : this.basePrice;
      var busySource = dayData ? dayData.busy_source : null;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'calendar-day';

      var currentDayOfWeek = (startDay + day - 1) % 7; // 0=Пн, 4=Пт, 5=Сб, 6=Вс

      if (currentDayOfWeek === 4) {
        btn.className += ' friday';
      } else if (currentDayOfWeek === 5) {
        btn.className += ' saturday';
      } else if (currentDayOfWeek === 6) {
        btn.className += ' sunday';
      }

      if (isPast) {
        btn.className += ' past';
      } else if (isBusy) {
        btn.className += ' busy';
      }
      if (isCheckoutBoundary) btn.className += ' checkout-option';

      if (isPromo && !isPast) {
        btn.className += ' promo';
      }

      /* Подсветка выделения */
      if (this.checkIn && dateStr === this.checkIn) {
        btn.className += ' selected';
      } else if (this.checkOut && dateStr === this.checkOut) {
        btn.className += ' selected';
      } else if (this.checkIn && this.checkOut && dateStr > this.checkIn && dateStr < this.checkOut) {
        btn.className += ' range-between';
      }

      var priceStr = (price && !isPast) ? String(price) + ' ₽' : '';
      var priceHtml = priceStr ? priceStr.replace(' ₽', '<span class="price-currency"> ₽</span>') : '';

      btn.innerHTML =
        '<span>' + day + '</span>' +
        (isBusy && !isPast
          ? '<small>' + (isCheckoutBoundary ? 'Выезд' : 'Занято') + '</small>'
          : (priceHtml ? '<small>' + priceHtml + '</small>' : ''));

      if (isBusy && !isPast) {
        btn.title = isCheckoutBoundary ? 'Дата выезда' : 'Занято';
      }

      /* Занятая дата кликабельна только как граница выезда. */
      if (!isPast && (!isBusy || canBeCheckout)) {
        btn.setAttribute('data-date', dateStr);
        btn.addEventListener('click', (function (ds) {
          return function () {
            self.handleDayClick(ds);
          };
        })(dateStr));
      }

      this.gridEl.appendChild(btn);
    }

    /* Обновляем инфо об акции */
    var promoInfoContainer = document.getElementById('promo-info-container');
    var promoInfoText = document.getElementById('promo-info-text');
    if (promoInfoContainer && promoInfoText) {
      var foundPromoDesc = null;
      if (this.checkIn) {
        var endStr = this.checkOut || this.checkIn;
        var curr = new Date(this.checkIn + 'T00:00:00');
        var end = new Date(endStr + 'T00:00:00');
        while (curr <= end) {
          var ds = EcoApi.toDateString(curr);
          var dd = this.availabilityMap[ds];
          if (dd && dd.is_promo && dd.promo_description) {
            foundPromoDesc = dd.promo_description;
            break;
          }
          curr.setDate(curr.getDate() + 1);
        }
      }
      
      if (foundPromoDesc) {
        promoInfoText.textContent = foundPromoDesc;
        promoInfoContainer.style.display = 'block';
      } else {
        promoInfoContainer.style.display = 'none';
        promoInfoText.textContent = '';
      }
    }
  };

  /**
   * Возвращает текущий выбранный диапазон.
   */
  EcoCalendar.prototype.getSelection = function () {
    return {
      checkIn: this.checkIn,
      checkOut: this.checkOut,
    };
  };

  /**
   * Сбрасывает выбор дат.
   */
  EcoCalendar.prototype.clearSelection = function () {
    this.checkIn = null;
    this.checkOut = null;
    this.render();
    this.onSelectionChange(null, null, []);
  };

  /**
   * Устанавливает выбор дат программно.
   */
  EcoCalendar.prototype.setSelection = function (checkIn, checkOut) {
    this.checkIn = checkIn;
    this.checkOut = checkOut;
    
    // Если нужно обновить видимый месяц
    if (this.checkIn) {
      var d = new Date(this.checkIn);
      this.currentYear = d.getFullYear();
      this.currentMonth = d.getMonth();
    }
    
    this.render();
    this.notifySelectionChange();
  };

  window.EcoCalendar = EcoCalendar;
})();
