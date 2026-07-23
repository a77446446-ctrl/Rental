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
const crypto = require('crypto');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { supabaseAdmin } = require('../config/supabase');
const bookingService = require('../services/booking.service');
const externalCalendarService = require('../services/externalCalendar.service');
const dataStore = require('../services/dataStore.service');
const { buildSupabaseMediaUrl, toSameOriginMediaPath } = require('./media.routes');

const publicRoot = path.join(__dirname, '../../public');

function addOneDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function getConfiguredLogoUrl() {
  try {
    const data = await dataStore.get('mainpage', 'mainpage.json', {});
    if (data.logo && data.logo.url) return toSameOriginMediaPath(data.logo.url);
  } catch (err) {}
  return '/icons/icon-192.png';
}

async function readConfiguredLogoBuffer(logoUrl) {
  if (logoUrl.startsWith('/media/supabase/')) {
    const encodedPath = logoUrl.slice('/media/supabase/'.length);
    const relativePath = encodedPath.split('/').map((segment) => decodeURIComponent(segment)).join('/');
    const upstreamUrl = buildSupabaseMediaUrl(relativePath);
    if (!upstreamUrl) throw new Error('Некорректный адрес логотипа');
    const response = await fetch(upstreamUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Логотип временно недоступен');
    return Buffer.from(await response.arrayBuffer());
  }

  if (logoUrl.startsWith('/')) {
    const localPath = path.resolve(publicRoot, '.' + logoUrl.split('?')[0]);
    if (!localPath.startsWith(publicRoot + path.sep)) throw new Error('Некорректный путь логотипа');
    return fs.promises.readFile(localPath);
  }

  throw new Error('Неподдерживаемый адрес логотипа');
}

const settingsPath = path.join(__dirname, '../data/settings.json');
const amenitiesPath = path.join(__dirname, '../data/amenities.json');
const extraServicesPath = path.join(__dirname, '../data/extra_services.json');
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

/* ─────────────────────────────────────────────
   GET /api/manifest.json
   Возвращает динамический манифест для PWA
   ───────────────────────────────────────────── */
router.get('/manifest.json', async (req, res) => {
  const logoUrl = await getConfiguredLogoUrl();
  const iconVersion = crypto.createHash('sha1').update(logoUrl).digest('hex').slice(0, 12);
  res.type('application/manifest+json').json({
    "id": "/",
    "name": "ECO-Gorniy",
    "short_name": "ECO-Gorniy",
    "description": "Бронирование домиков ECO-Gorniy",
    "lang": "ru-RU",
    "start_url": "/",
    "scope": "/",
    "display": "standalone",
    "display_override": ["standalone", "minimal-ui"],
    "orientation": "portrait-primary",
    "background_color": "#120f0d",
    "theme_color": "#120f0d",
    "categories": ["travel", "lifestyle"],
    "icons": [
      {
        "src": `/api/pwa-icon/192.png?v=${iconVersion}`,
        "type": "image/png",
        "sizes": "192x192",
        "purpose": "any"
      },
      {
        "src": `/api/pwa-icon/512.png?v=${iconVersion}`,
        "type": "image/png",
        "sizes": "512x512",
        "purpose": "any"
      }
    ]
  });
});

router.get('/pwa-icon/:size.png', async (req, res) => {
  const size = Number(req.params.size);
  if (size !== 192 && size !== 512) {
    return res.status(404).end();
  }

  try {
    const logoUrl = await getConfiguredLogoUrl();
    const source = await readConfiguredLogoBuffer(logoUrl);
    const icon = await sharp(source)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: false,
      })
      .png()
      .toBuffer();

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.type('image/png').send(icon);
  } catch (err) {
    console.error('[pwa-icon] Не удалось подготовить логотип:', err.message);
    return res.redirect(302, size === 512 ? '/icons/icon-512.png' : '/icons/icon-192.png');
  }
});

/* ─────────────────────────────────────────────
   GET /api/icon.png
   Динамический фавикон (редирект на актуальный логотип)
   ───────────────────────────────────────────── */
router.get('/icon.png', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.redirect(302, '/api/pwa-icon/192.png');
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
    const services = await dataStore.get('extra_services', 'extra_services.json', []);
    const active = services.filter(s => s.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    res.json({ success: true, data: active });
  } catch (err) {
    console.error('[public.routes] Ошибка загрузки extra-services:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки услуг' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/house-items
   Возвращает публичный список наполнения домиков.
   ───────────────────────────────────────────── */
router.get('/house-items', async (req, res) => {
  try {
    const items = await dataStore.get('house_items', 'house_items.json', []);
    const active = items.filter(s => s.is_active !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    res.json({ success: true, data: active });
  } catch (err) {
    console.error('[public.routes] Ошибка загрузки house-items:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки наполнения' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/settings
   Возвращает глобальные настройки.
   ───────────────────────────────────────────── */
router.get('/settings', async (_req, res) => {
  try {
    const settings = await dataStore.get('settings', 'settings.json', { checkInTime: '16:00', checkOutTime: '14:00' });
    return res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[public.routes] Ошибка загрузки settings:', err);
    return res.status(500).json({ success: false, error: 'Ошибка загрузки настроек' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/amenities
   Возвращает привязки услуг к домикам.
   ───────────────────────────────────────────── */
router.get('/amenities', async (_req, res) => {
  try {
    const amenities = await dataStore.get('amenities', 'amenities.json', {});
    return res.json({ success: true, data: amenities });
  } catch (err) {
    console.error('[public.routes] Ошибка загрузки amenities:', err);
    return res.status(500).json({ success: false, error: 'Ошибка загрузки наполнения' });
  }
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
    const mainpageData = await dataStore.get('mainpage', 'mainpage.json', {});
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
    const tags = await dataStore.get('tags', 'tags.json', []);
    res.json({ success: true, data: tags });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Ошибка загрузки тегов' });
  }
});

/**
 * GET /api/cabin-tags
 * Получить привязки тегов к домикам
 */
router.get('/cabin-tags', async (_req, res) => {
  try {
    const cabinTags = await dataStore.get('cabin_tags', 'cabin_tags.json', {});
    // Этот исторический endpoint возвращает объект напрямую; сохраняем контракт фронтенда.
    return res.json(cabinTags);
  } catch (err) {
    console.error('[public.routes] Ошибка загрузки cabin-tags:', err);
    return res.status(500).json({ success: false, error: 'Ошибка загрузки тегов домиков' });
  }
});

/**
 * POST /api/bookings
 * Создать бронирование
 */
router.post('/bookings', async (req, res) => {
  try {
    const { cabin_id, check_in, check_out, guest_name, guest_phone, guest_telegram, comment, extras, guests_count, chat_token } = req.body;
    
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
      extras: Array.isArray(extras) ? extras : []
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
        const msg = `Ваша заявка на бронирование домика «${cabinData.name}» успешно создана!\n\nДаты: ${fCheckIn} — ${fCheckOut}\nКоличество гостей: ${normalizedGuestsCount}\nИтоговая стоимость: ${booking.total_price} ₽\n\n---\n\nНаш администратор свяжется с вами в ближайшее время для подтверждения.\n\nВАЖНО: Пожалуйста, напишите нам любое сообщение (например, «Здравствуйте!»), чтобы администратор смог ответить вам прямо здесь.\nЕсли в течение 10 минут с вами не связались, попробуйте перезвонить по номеру, указанному в контактах.`;
        await chatService.saveMessage(chat_token, msg, 'admin');
      } catch (err) {
        console.error('[public.routes] Ошибка отправки сообщения в чат:', err);
      }
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('[public.routes] Ошибка POST /bookings:', err.message);
    const message = String(err.message || '');
    if (message.includes('занят') || message.includes('пересекаются')) {
      return res.status(409).json({ success: false, error: message });
    }
    if (/неверн|обязатель|максимум|недоступ|закрыта|позже|длиннее/i.test(message)) {
      return res.status(400).json({ success: false, error: message });
    }
    res.status(500).json({ success: false, error: 'Ошибка при создании заявки' });
  }
});

/* ────────────────────────────────────────
   Экспорт iCal-ленты для синхронизации с Авито и другими площадками.
   GET /api/ical/export/:cabin_slug.ics
   ──────────────────────────────────────── */
router.get('/ical/export/:slug', async (req, res) => {
  try {
    let slug = req.params.slug;
    // Убираем расширение .ics если есть
    if (slug.endsWith('.ics')) {
      slug = slug.slice(0, -4);
    }

    if (!supabaseAdmin) {
      return res.status(503).send('Сервис временно недоступен');
    }

    // Находим домик по slug
    const { data: cabin, error: cabinError } = await supabaseAdmin
      .from('cabins')
      .select('id, name, slug')
      .eq('slug', slug)
      .single();

    if (cabinError || !cabin) {
      return res.status(404).send('Объект не найден');
    }

    // Загружаем активные бронирования (pending + confirmed)
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, check_in, check_out, status')
      .eq('cabin_id', cabin.id)
      .in('status', ['pending', 'confirmed']);

    if (bookingsError) {
      console.error('[ical-export] Ошибка загрузки бронирований:', bookingsError.message);
      return res.status(500).send('Ошибка сервера');
    }

    // Загружаем закрытые даты (promo_description === 'CLOSED')
    const { data: closedDates } = await supabaseAdmin
      .from('prices')
      .select('date')
      .eq('cabin_id', cabin.id)
      .eq('promo_description', 'CLOSED');

    // Формируем iCal
    const now = new Date();
    const formatDate = (dateStr) => dateStr.replace(/-/g, '');
    const formatTimestamp = (d) => {
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const escapeIcalText = (value) => String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');

    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EcoGorniy//Cabin Rental//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeIcalText(cabin.name)} — eco-gorniy.ru`,
      `X-WR-TIMEZONE:Europe/Moscow`,
    ];

    // Добавляем бронирования как события
    if (bookings && bookings.length > 0) {
      bookings.forEach((booking) => {
        // Не публикуем имя гостя и внутренний UUID в доступной по ссылке iCal-ленте.
        const uid = crypto.createHash('sha256')
          .update(`booking:${booking.id}`)
          .digest('hex') + '@eco-gorniy.ru';

        ical.push('BEGIN:VEVENT');
        ical.push(`UID:${uid}`);
        ical.push(`DTSTART;VALUE=DATE:${formatDate(booking.check_in)}`);
        ical.push(`DTEND;VALUE=DATE:${formatDate(booking.check_out)}`);
        ical.push('SUMMARY:Занято');
        ical.push(`DESCRIPTION:Бронирование через eco-gorniy.ru`);
        ical.push(`STATUS:CONFIRMED`);
        ical.push(`DTSTAMP:${formatTimestamp(now)}`);
        ical.push('END:VEVENT');
      });
    }

    // Добавляем закрытые даты
    if (closedDates && closedDates.length > 0) {
      // Группируем последовательные закрытые даты в диапазоны
      const sorted = closedDates.map(d => d.date).sort();
      let rangeStart = sorted[0];
      let rangeEnd = sorted[0];

      for (let i = 1; i <= sorted.length; i++) {
        const current = sorted[i];
        if (current) {
          const prevDate = new Date(rangeEnd + 'T00:00:00');
          prevDate.setDate(prevDate.getDate() + 1);
          const prevStr = prevDate.getFullYear() + '-' +
            String(prevDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(prevDate.getDate()).padStart(2, '0');

          if (current === prevStr) {
            rangeEnd = current;
            continue;
          }
        }

        // Закрываем диапазон
        const endDate = new Date(rangeEnd + 'T00:00:00');
        endDate.setDate(endDate.getDate() + 1);
        const endStr = endDate.getFullYear() +
          String(endDate.getMonth() + 1).padStart(2, '0') +
          String(endDate.getDate()).padStart(2, '0');

        const uid = `closed-${rangeStart}@eco-gorniy.ru`;
        ical.push('BEGIN:VEVENT');
        ical.push(`UID:${uid}`);
        ical.push(`DTSTART;VALUE=DATE:${formatDate(rangeStart)}`);
        ical.push(`DTEND;VALUE=DATE:${endStr}`);
        ical.push(`SUMMARY:Закрыто`);
        ical.push(`DESCRIPTION:Даты закрыты администратором`);
        ical.push(`STATUS:CONFIRMED`);
        ical.push(`DTSTAMP:${formatTimestamp(now)}`);
        ical.push('END:VEVENT');

        if (current) {
          rangeStart = current;
          rangeEnd = current;
        }
      }
    }

    ical.push('END:VCALENDAR');

    const icalContent = ical.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${cabin.slug}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(icalContent);

  } catch (err) {
    console.error('[ical-export] Ошибка:', err.message);
    res.status(500).send('Ошибка генерации календаря');
  }
});

module.exports = router;
