/**
 * Публичные API-маршруты.
 * Доступны без авторизации. Возвращают данные для фронтенда.
 *
 * GET /api/cabins          — список активных домиков
 * GET /api/cabins/:slug    — один домик по slug
 * GET /api/extra-services  — список активных доп. услуг
 * GET /api/prices          — календарь цен (с фильтрами)
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { apiLimiter } = require('../middleware/rateLimit');
const bookingService = require('../services/booking.service');
const externalCalendarService = require('../services/externalCalendar.service');

function addOneDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

const settingsPath = path.join(__dirname, '../data/settings.json');
const amenitiesPath = path.join(__dirname, '../data/amenities.json');
const extraServicesPath = path.join(__dirname, '../data/extra_services.json');
const mainpagePath = path.join(__dirname, '../data/mainpage.json');
const tagsPath = path.join(__dirname, '../data/tags.json');
const cabinTagsPath = path.join(__dirname, '../data/cabin_tags.json');

function mapCabinForPublic(cabin) {
  const imagesUrls = Array.isArray(cabin.images_urls) ? cabin.images_urls : [];
  const images = Array.isArray(cabin.images)
    ? cabin.images
    : imagesUrls.map(str => {
      try { return JSON.parse(str); }
      catch (e) { return { url: str, category: 'main' }; }
    });

  return {
    ...cabin,
    images_urls: imagesUrls,
    images,
    image_url: images.length > 0 ? images[0].url : '',
  };
}

/* Применяем API rate-limit ко всем маршрутам этого роутера */
router.use(apiLimiter);

/* ─────────────────────────────────────────────
   GET /api/manifest.json
   Возвращает динамический манифест для PWA
   ───────────────────────────────────────────── */
router.get('/manifest.json', (req, res) => {
  let logoUrl = '/icons/icon-192.png';
  try {
    if (fs.existsSync(mainpagePath)) {
      const data = JSON.parse(fs.readFileSync(mainpagePath, 'utf8'));
      if (data.logo && data.logo.url) {
        logoUrl = data.logo.url;
      }
    }
  } catch (err) {}

  res.json({
    "name": "ECO-Gorniy",
    "short_name": "ECO-Gorniy",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#120f0d",
    "theme_color": "#120f0d",
    "icons": [
      {
        "src": logoUrl,
        "type": "image/png",
        "sizes": "192x192"
      },
      {
        "src": logoUrl,
        "type": "image/png",
        "sizes": "512x512"
      }
    ]
  });
});

/* ─────────────────────────────────────────────
   GET /api/cabins
   Возвращает все активные домики, отсортированные по sort_order.
   ───────────────────────────────────────────── */

router.get('/cabins', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error: 'Сервис базы данных временно недоступен',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('cabins')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error) {
      console.error('[public.routes] Ошибка при получении домиков:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Не удалось загрузить домики',
      });
    }

    const mappedData = (data || [])
      .filter(cabin => cabin.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(mapCabinForPublic);

    return res.status(200).json({
      success: true,
      data: mappedData,
      meta: { source: 'supabase' },
    });
  } catch (err) {
    console.error('[public.routes] Исключение в GET /api/cabins:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    });
  }
});

/* ─────────────────────────────────────────────
   GET /api/cabins/:slug
   Возвращает один домик по slug.
   ───────────────────────────────────────────── */

router.get('/cabins/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    /* Проверяем формат slug: только латиница, цифры, дефисы, подчёркивания */
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный идентификатор домика',
      });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error: 'Сервис базы данных временно недоступен',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('cabins')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Домик не найден',
      });
    }

    return res.status(200).json({
      success: true,
      data: mapCabinForPublic(data),
    });
  } catch (err) {
    console.error('[public.routes] Исключение в GET /api/cabins/:slug:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    });
  }
});

/* ─────────────────────────────────────────────
   GET /api/extra-services
   Возвращает все активные дополнительные услуги.
   ───────────────────────────────────────────── */
router.get('/extra-services', async (req, res) => {
  try {
    let services = [];
    if (fs.existsSync(extraServicesPath)) {
      services = JSON.parse(fs.readFileSync(extraServicesPath, 'utf8'));
    }
    const active = services.filter(s => s.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    res.json({ success: true, data: active });
  } catch (err) {
    console.error('[public.routes] Ошибка загрузки extra-services:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки услуг' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/settings
   Возвращает глобальные настройки.
   ───────────────────────────────────────────── */
router.get('/settings', (req, res) => {
  const settingsPath = path.join(__dirname, '../data/settings.json');
  let settings = { checkInTime: '16:00', checkOutTime: '14:00' };
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (err) {
    console.error('Ошибка чтения settings.json:', err);
  }
  return res.json({ success: true, data: settings });
});

/* ─────────────────────────────────────────────
   GET /api/amenities
   Возвращает привязки услуг к домикам.
   ───────────────────────────────────────────── */
router.get('/amenities', (req, res) => {
  const amenitiesPath = path.join(__dirname, '../data/amenities.json');
  let amenities = {};
  try {
    if (fs.existsSync(amenitiesPath)) {
      amenities = JSON.parse(fs.readFileSync(amenitiesPath, 'utf8'));
    }
  } catch (err) {
    console.error('Ошибка чтения amenities.json:', err);
  }
  return res.json({ success: true, data: amenities });
});

/* ─────────────────────────────────────────────
   GET /api/prices
   Возвращает календарь цен.

   Query-параметры (все необязательные):
     cabin_id  — UUID домика (фильтр по одному домику)
     from      — начало диапазона дат (YYYY-MM-DD), по умолчанию сегодня
     to        — конец диапазона дат (YYYY-MM-DD), по умолчанию +90 дней
   ───────────────────────────────────────────── */

router.get('/prices', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error: 'Сервис базы данных временно недоступен',
      });
    }

    const { cabin_id, from, to } = req.query;

    /* Валидация cabin_id (UUID формат) */
    if (cabin_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cabin_id)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный идентификатор домика',
      });
    }

    /* Валидация формата дат */
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (from && !dateRegex.test(from)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат даты «от». Используйте YYYY-MM-DD',
      });
    }

    if (to && !dateRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат даты «до». Используйте YYYY-MM-DD',
      });
    }

    /* Дефолты: от сегодня до +90 дней */
    const today = new Date();
    const defaultFrom = today.toISOString().split('T')[0];
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 90);
    const defaultTo = futureDate.toISOString().split('T')[0];

    const dateFrom = from || defaultFrom;
    const dateTo = to || defaultTo;

    /* Собираем запрос */
    let query = supabaseAdmin
      .from('prices')
      .select('id, cabin_id, date, custom_price, is_promo, promo_description')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true });

    if (cabin_id) {
      query = query.eq('cabin_id', cabin_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[public.routes] Ошибка при получении цен:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Не удалось загрузить календарь цен',
      });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
      meta: {
        from: dateFrom,
        to: dateTo,
        cabin_id: cabin_id || null,
      },
    });
  } catch (err) {
    console.error('[public.routes] Исключение в GET /api/prices:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    });
  }
});

/* ─────────────────────────────────────────────
   GET /api/availability
   Возвращает доступность дат для конкретного домика:
   цена за каждую дату, занят/свободен, промо-флаг.

   Query-параметры:
     cabin_id  — UUID домика (обязательный)
     from      — начало диапазона (YYYY-MM-DD), по умолчанию сегодня
     to        — конец диапазона (YYYY-MM-DD), по умолчанию +90 дней
   ───────────────────────────────────────────── */

router.get('/availability', async (req, res) => {
  try {
    const { cabin_id, from, to } = req.query;

    /* cabin_id обязателен */
    if (!cabin_id) {
      return res.status(400).json({
        success: false,
        error: 'Параметр cabin_id обязателен',
      });
    }

    /* Валидация UUID */
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cabin_id)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный идентификатор домика',
      });
    }

    /* Валидация дат */
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (from && !dateRegex.test(from)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат даты «от». Используйте YYYY-MM-DD',
      });
    }

    if (to && !dateRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат даты «до». Используйте YYYY-MM-DD',
      });
    }

    /* Дефолты: от сегодня до +90 дней */
    const today = new Date();
    const defaultFrom = today.toISOString().split('T')[0];
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 90);
    const defaultTo = futureDate.toISOString().split('T')[0];

    const dateFrom = from || defaultFrom;
    const dateTo = to || defaultTo;

    if (!supabaseAdmin) {
      return res.status(503).json({
        success: false,
        error: 'Сервис базы данных временно недоступен',
      });
    }

    /* 1. Получаем base_price и name домика */
    const { data: cabinData, error: cabinError } = await supabaseAdmin
      .from('cabins')
      .select('id, name, base_price')
      .eq('id', cabin_id)
      .eq('is_active', true)
      .single();

    if (cabinError || !cabinData) {
      return res.status(404).json({
        success: false,
        error: 'Домик не найден',
      });
    }

    /* 2. Получаем кастомные цены в диапазоне */
    const { data: pricesData, error: pricesError } = await supabaseAdmin
      .from('prices')
      .select('date, custom_price, is_promo, promo_description')
      .eq('cabin_id', cabin_id)
      .gte('date', dateFrom)
      .lte('date', dateTo);

    if (pricesError) {
      console.error('[public.routes] Ошибка при получении цен:', pricesError.message);
      return res.status(500).json({
        success: false,
        error: 'Не удалось загрузить цены',
      });
    }

    /* Создаём карту цен по датам для быстрого поиска */
    const priceMap = {};
    if (pricesData) {
      for (let i = 0; i < pricesData.length; i++) {
        priceMap[pricesData[i].date] = pricesData[i];
      }
    }

    /* 3. Получаем активные бронирования в диапазоне */
    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('check_in, check_out')
      .eq('cabin_id', cabin_id)
      .in('status', ['pending', 'confirmed'])
      .lte('check_in', dateTo)
      .gte('check_out', dateFrom);

    if (bookingsError) {
      console.error('[public.routes] Ошибка при получении бронирований:', bookingsError.message);
      return res.status(500).json({
        success: false,
        error: 'Не удалось проверить доступность',
      });
    }

    const externalBookings = await externalCalendarService.getExternalBookingsForRange(cabin_id, dateFrom, addOneDay(dateTo));

    /* Создаём множество занятых дат (check_out исключительный — [)) */
    const busyDates = new Set();
    const externalBusyMap = {};
    if (bookingsData) {
      for (let i = 0; i < bookingsData.length; i++) {
        const checkIn = new Date(bookingsData[i].check_in + 'T00:00:00');
        const checkOut = new Date(bookingsData[i].check_out + 'T00:00:00');
        const current = new Date(checkIn);

        while (current < checkOut) {
          const dateStr =
            current.getFullYear() + '-' +
            String(current.getMonth() + 1).padStart(2, '0') + '-' +
            String(current.getDate()).padStart(2, '0');
          busyDates.add(dateStr);
          current.setDate(current.getDate() + 1);
        }
      }
    }

    if (externalBookings) {
      for (let i = 0; i < externalBookings.length; i++) {
        const checkIn = new Date(externalBookings[i].check_in + 'T00:00:00');
        const checkOut = new Date(externalBookings[i].check_out + 'T00:00:00');
        const current = new Date(checkIn);

        while (current < checkOut) {
          const dateStr =
            current.getFullYear() + '-' +
            String(current.getMonth() + 1).padStart(2, '0') + '-' +
            String(current.getDate()).padStart(2, '0');

          busyDates.add(dateStr);
          externalBusyMap[dateStr] = {
            source: externalBookings[i].source_name || 'Внешний календарь',
            summary: externalBookings[i].summary || null,
          };
          current.setDate(current.getDate() + 1);
        }
      }
    }

    /* 4. Формируем массив дат с ценами и доступностью */
    const dates = [];
    const startDate = new Date(dateFrom + 'T00:00:00');
    const endDate = new Date(dateTo + 'T00:00:00');
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr =
        currentDate.getFullYear() + '-' +
        String(currentDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(currentDate.getDate()).padStart(2, '0');

      const priceEntry = priceMap[dateStr];

      dates.push({
        date: dateStr,
        price: priceEntry ? priceEntry.custom_price : cabinData.base_price,
        available: !busyDates.has(dateStr) && !(priceEntry && priceEntry.promo_description === 'CLOSED'),
        is_promo: priceEntry ? priceEntry.is_promo : false,
        promo_description: priceEntry ? (priceEntry.promo_description || null) : null,
        busy_source: externalBusyMap[dateStr] ? externalBusyMap[dateStr].source : null,
        busy_summary: externalBusyMap[dateStr] ? externalBusyMap[dateStr].summary : null,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return res.status(200).json({
      success: true,
      data: {
        cabin_id: cabinData.id,
        cabin_name: cabinData.name,
        base_price: cabinData.base_price,
        dates: dates,
      },
    });
  } catch (err) {
    console.error('[public.routes] Исключение в GET /api/availability:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    });
  }
});

/**
 * GET /api/settings
 * Получить глобальные настройки
 */
router.get('/settings', async (req, res) => {
  try {
    let settings = { checkInTime: '16:00', checkOutTime: '14:00' };
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки настроек' });
  }
});

/**
 * GET /api/amenities
 * Получить услуги всех домиков
 */
router.get('/amenities', async (req, res) => {
  try {
    let amenities = {};
    if (fs.existsSync(amenitiesPath)) {
      amenities = JSON.parse(fs.readFileSync(amenitiesPath, 'utf8'));
    }
    res.json({ success: true, data: amenities });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки услуг' });
  }
});

/**
 * GET /api/mainpage
 * Получить настройки главной страницы
 */
router.get('/mainpage', async (req, res) => {
  try {
    let mainpageData = {};
    if (fs.existsSync(mainpagePath)) {
      mainpageData = JSON.parse(fs.readFileSync(mainpagePath, 'utf8'));
    }
    res.json({ success: true, data: mainpageData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки главной страницы' });
  }
});

/**
 * GET /api/tags
 * Получить список тегов
 */
router.get('/tags', async (req, res) => {
  try {
    let tags = [];
    if (fs.existsSync(tagsPath)) {
      tags = JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
    }
    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки тегов' });
  }
});

/**
 * GET /api/cabin-tags
 * Получить привязки тегов к домикам
 */
router.get('/cabin-tags', (req, res) => {
  let cabinTags = {};
  try {
    if (fs.existsSync(cabinTagsPath)) {
      cabinTags = JSON.parse(fs.readFileSync(cabinTagsPath, 'utf8'));
    }
  } catch (err) {
    console.error('Ошибка чтения cabin_tags.json:', err);
  }
  return res.json(cabinTags);
});

/**
 * POST /api/bookings
 * Создать бронирование
 */
router.post('/bookings', async (req, res) => {
  try {
    const { cabin_id, check_in, check_out, guest_name, guest_phone, guest_telegram, comment, total_price, extras, guests_count, chat_token } = req.body;
    
    if (!cabin_id || !check_in || !check_out || !guest_name || !guest_phone) {
      return res.status(400).json({ success: false, error: 'Заполните все обязательные поля' });
    }

    const normalizedGuestsCount = Math.max(1, parseInt(guests_count, 10) || 2);

    if (!supabaseAdmin) {
      return res.status(503).json({ success: false, error: 'Сервис базы данных временно недоступен' });
    }

    const { data: cabinData, error: cabinError } = await supabaseAdmin
      .from('cabins')
      .select('id, name, capacity')
      .eq('id', cabin_id)
      .eq('is_active', true)
      .single();

    if (cabinError || !cabinData) {
      return res.status(404).json({ success: false, error: 'Домик не найден' });
    }

    const cabinCapacity = Math.max(1, parseInt(cabinData.capacity, 10) || 1);
    if (normalizedGuestsCount > cabinCapacity) {
      return res.status(400).json({
        success: false,
        error: 'В домике «' + cabinData.name + '» максимум ' + cabinCapacity + ' гостей'
      });
    }

    const finalComment = chat_token 
      ? (comment ? comment + '\n\n' : '') + `<!--CHAT_TOKEN:${chat_token}-->`
      : comment;

    const booking = await bookingService.createBooking({
      cabin_id,
      check_in,
      check_out,
      guest_name,
      guest_phone,
      guest_telegram,
      comment: finalComment,
      guests_count: normalizedGuestsCount,
      total_price: total_price || 0,
      extras: (extras || []).map(id => ({ service_id: id, price_at_booking: 0 })) // Упрощено для публичного API
    });

    if (chat_token) {
      try {
        const chatService = require('../services/chat.service');
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const formatD = (dStr) => {
          const parts = dStr.split('-');
          return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1];
        };
        const fCheckIn = formatD(check_in);
        const fCheckOut = formatD(check_out);
        const msg = `Ваша заявка на бронирование домика «${cabinData.name}» успешно создана!\n\nДаты: ${fCheckIn} — ${fCheckOut}\nКоличество гостей: ${normalizedGuestsCount}\nИтоговая стоимость: ${total_price || 0} ₽\n\n---\n\nНаш администратор свяжется с вами в ближайшее время для подтверждения.\n\nВАЖНО: Пожалуйста, напишите нам любое сообщение (например, «Здравствуйте!»), чтобы администратор смог ответить вам прямо здесь.\nЕсли в течение 10 минут с вами не связались, попробуйте перезвонить по номеру, указанному в контактах.`;
        await chatService.saveMessage(chat_token, msg, 'admin');
      } catch (err) {
        console.error('[public.routes] Ошибка отправки сообщения в чат:', err);
      }
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('[public.routes] Ошибка POST /bookings:', err.message);
    const message = String(err.message || '');
    if (message.includes('внешнем календаре')) {
      return res.status(409).json({ success: false, error: message });
    }
    res.status(500).json({ success: false, error: 'Ошибка при создании заявки' });
  }
});

module.exports = router;
