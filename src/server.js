/**
 * Точка входа приложения eco-gorniy.ru
 * Настраивает Express-сервер: безопасность, парсинг, статика, маршруты, healthcheck.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { config, validateEnv } = require('./config/env');
const publicRoutes = require('./routes/public.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');
const { router: mediaRoutes, handlePocketbaseProxy } = require('./routes/media.routes');
const { requireAdmin } = require('./middleware/auth');
const externalCalendarService = require('./services/externalCalendar.service');
const { pbAdmin } = require('./config/pocketbase');

/* Валидация переменных окружения */
validateEnv();

const app = express();

/* ────────────────────────────────────────
   Безопасность
   ──────────────────────────────────────── */

/**
 * Helmet: заголовки безопасности.
 * Content Security Policy настроена для работы со шрифтами Google,
 * изображениями из Supabase Storage и Unsplash, а также inline-стилями.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://api-maps.yandex.ru", "https://yastatic.net", "https://mc.yandex.ru", "https://*.yandex.ru"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://images.unsplash.com",
          "https://*.supabase.co",
          "https://*.maps.yandex.net",
          "https://core-renderer-tiles.maps.yandex.net",
          "https://api-maps.yandex.ru",
          "https://mc.yandex.ru",
          "https://*.yandex.ru",
          "https://favicon.yandex.net"
        ],
        mediaSrc: [
          "'self'",
          "https://*.supabase.co",
        ],
        connectSrc: [
          "'self'", 
          "wss://*.supabase.co", 
          "https://*.supabase.co",
          "https://api-maps.yandex.ru",
          "https://mc.yandex.ru",
          "https://*.yandex.ru",
          "https://favicon.yandex.net",
          "https://*.maps.yandex.net",
          "https://core-renderer-tiles.maps.yandex.net"
        ],
        frameSrc: [
          "'self'", 
          "https://www.youtube.com", 
          "https://player.vimeo.com", 
          "https://vk.com",
          "https://vkvideo.ru",
          "https://webvisor.com",
          "https://*.yandex.ru"
        ],
        objectSrc: ["'none'"],
        childSrc: ["'self'", "blob:", "https://webvisor.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

/* ────────────────────────────────────────
   Парсинг запросов
   ──────────────────────────────────────── */

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(config.cookieSecret));

/* Доверяем первому прокси Coolify, чтобы точечные защитные лимитеры
   авторизации и загрузок видели реальный IP посетителя. */
app.set('trust proxy', 1);

/* Публичные изображения и видео отдаём через домен приложения. Это позволяет
   сайту работать у провайдеров, где прямой доступ к *.supabase.co нестабилен. */
app.use('/media', mediaRoutes);

/* Прямой прокси для файлов PocketBase через /api/files/... */
app.get('/api/files/*', (req, res) => {
  return handlePocketbaseProxy(req.params[0], req, res);
});

/* Перенаправление стандартного запроса фавикона браузера */
app.get('/favicon.ico', (_req, res) => {
  res.redirect(302, '/api/icon.png');
});

/* Автоматическое подтверждение прав в Яндекс Вебмастере (yandex_*.html) */
app.get('/yandex_:code.html', (req, res) => {
  const code = req.params.code;
  res.type('text/html').send(`<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body>Verification: ${code}</body></html>`);
});

/* Динамическая карта сайта sitemap.xml для поисковых систем (Яндекс, Google) */
app.get('/sitemap.xml', async (_req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const domain = (config.baseUrl && !config.baseUrl.includes('localhost')) ? config.baseUrl : 'https://eco-gorniy.ru';
  const today = new Date().toISOString().slice(0, 10);

  let cabinUrls = '';
  try {
    const cabins = await pbAdmin.collection('cabins').getFullList({
      filter: 'is_active = true',
      fields: 'id,slug,updated',
    });
    cabinUrls = cabins.map((c) => {
      const slugOrId = c.slug || c.id;
      const mod = c.updated ? c.updated.slice(0, 10) : today;
      return `  <url>\n    <loc>${domain}/cabin.html?id=${slugOrId}</loc>\n    <lastmod>${mod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    }).join('\n');
  } catch (_e) {
    // fallback
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${domain}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>${domain}/cabin.html</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n${cabinUrls ? cabinUrls + '\n' : ''}</urlset>`;
  res.send(xml);
});

/* Динамическая конфигурация Яндекс Метрики и Вебмастера */
app.get('/api/seo-config.js', async (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');

  let metrikaId = config.yandexMetrikaId || '';
  let verification = config.yandexVerification || '';

  try {
    const dataStore = require('./services/dataStore.service');
    const settings = await dataStore.get('settings', 'settings.json', {});
    if (settings) {
      if (settings.yandexMetrikaId) metrikaId = settings.yandexMetrikaId;
      if (settings.yandexVerification) verification = settings.yandexVerification;
    }
  } catch (_e) {}

  res.send(`window.YANDEX_METRIKA_ID = ${JSON.stringify(metrikaId)};\nwindow.YANDEX_VERIFICATION = ${JSON.stringify(verification)};`);
});

/* ────────────────────────────────────────
   Защита статики админ-панели
   ──────────────────────────────────────── */
app.use('/admin', (req, res, next) => {
  if (req.path === '/login' || req.path === '/login.html') {
    return next();
  }
  requireAdmin(req, res, next);
});

/* ────────────────────────────────────────
   Техническое обслуживание (Server-side)
   ──────────────────────────────────────── */
const serveHtmlWithSeo = (fileName) => {
  return async (req, res) => {
    try {
      const fullPath = path.join(__dirname, '..', 'public', fileName);
      let html = await fs.promises.readFile(fullPath, 'utf8');

      let metrikaId = config.yandexMetrikaId || '114026887';
      let verification = config.yandexVerification || '';
      try {
        const dataStore = require('./services/dataStore.service');
        const settings = await dataStore.get('settings', 'settings.json', {});
        if (settings) {
          if (settings.yandexMetrikaId) metrikaId = settings.yandexMetrikaId;
          if (settings.yandexVerification) verification = settings.yandexVerification;
        }
      } catch (_e) {}

      html = html.replace(/%YANDEX_METRIKA_ID%/g, metrikaId);
      html = html.replace(/%YANDEX_VERIFICATION%/g, verification);

      // Уникализация заголовков и описаний для каждого домика (устранение дублей title в Яндексе)
      if (fileName === 'cabin.html' && req && req.query && (req.query.id || req.query.slug)) {
        const cabinIdOrSlug = String(req.query.id || req.query.slug).trim();
        try {
          let cabin = null;
          try {
            cabin = await pbAdmin.collection('cabins').getOne(cabinIdOrSlug);
          } catch (_e1) {
            cabin = await pbAdmin.collection('cabins').getFirstListItem(`slug="${cabinIdOrSlug}"`);
          }
          if (cabin && cabin.name) {
            const domain = (config.baseUrl && !config.baseUrl.includes('localhost')) ? config.baseUrl : 'https://eco-gorniy.ru';
            const cabinTitle = `${cabin.name} — Аренда домика в лесу у озера в Подмосковье | ЭКО Горный`;
            const cleanDesc = (cabin.description || '').replace(/"/g, '&quot;').slice(0, 150);
            const cabinDesc = `Снять домик «${cabin.name}» (до ${cabin.capacity || 2} гостей) на базе отдыха «ЭКО Горный» в Подмосковье (д. Пашуково, Горный проезд). ${cleanDesc}`;

            html = html.replace(/<title>.*?<\/title>/i, `<title>${cabinTitle}</title>`);
            html = html.replace(/<meta name="description" content=".*?"/i, `<meta name="description" content="${cabinDesc}"`);
            html = html.replace(/<link rel="canonical" href=".*?"/i, `<link rel="canonical" href="${domain}/cabin.html?id=${encodeURIComponent(cabin.slug || cabin.id)}"`);
            html = html.replace(/<meta property="og:title" content=".*?"/i, `<meta property="og:title" content="${cabinTitle}"`);
            html = html.replace(/<meta property="og:description" content=".*?"/i, `<meta property="og:description" content="${cabinDesc}"`);
          }
        } catch (_cabErr) {}
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.send(html);
    } catch (err) {
      return res.sendFile(path.join(__dirname, '..', 'public', fileName));
    }
  };
};

app.use(async (req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/admin') && !req.path.startsWith('/api') && !req.path.startsWith('/media')) {
    if (req.path === '/' || req.path === '/index.html' || (req.headers.accept && req.headers.accept.includes('text/html'))) {
      try {
        const dataStore = require('./services/dataStore.service');
        const settings = await dataStore.get('settings', 'settings.json', {});
        if (settings && settings.maintenanceMode) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          return res.status(503).sendFile(path.join(__dirname, '..', 'public', 'maintenance.html'));
        }
      } catch (err) {
        // ignore
      }

      if (['/', '/index.html', '/cabin.html', '/success.html'].includes(req.path)) {
        const fileName = (req.path === '/' || req.path === '/index.html') ? 'index.html' : req.path.slice(1);
        return serveHtmlWithSeo(fileName)(req, res);
      }
      }
    }
  }
  next();
});

/* ────────────────────────────────────────
   Статические файлы
   ──────────────────────────────────────── */

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    extensions: ['html'],
    maxAge: config.nodeEnv === 'production' ? '1d' : 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Service-Worker-Allowed', '/');
      } else if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.webmanifest')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    },
  })
);

/* ────────────────────────────────────────
   Healthcheck
   ──────────────────────────────────────── */

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.nodeEnv,
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await Promise.all([
      pbAdmin.collection('cabins').getList(1, 1, { fields: 'id' }),
      pbAdmin.collection('app_config').getList(1, 1, { fields: 'id' }),
    ]);
    return res.status(200).json({ status: 'ready', database: true, app_config: true });
  } catch (error) {
    console.error('[ready] PocketBase unavailable:', error.message);
    return res.status(503).json({ status: 'not_ready', database: false, app_config: false });
  }
});

/* Прокси для публичных файлов PocketBase (/api/files/...) */
app.get('/api/files/*', (req, res) => handlePocketbaseProxy(req.params[0], req, res));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/api', publicRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

/* ────────────────────────────────────────
   Обработка 404
   ──────────────────────────────────────── */

app.use((req, res) => {
  /* Если запрос к API — вернуть JSON */
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Маршрут не найден',
    });
  }

  /* Для остальных — отдаём index.html (SPA-подход) */
  return serveHtmlWithSeo('index.html')(req, res);
});

/* ────────────────────────────────────────
   Глобальный обработчик ошибок
   ──────────────────────────────────────── */

app.use((err, req, res, _next) => {
  console.error(`\x1b[31m[server] Ошибка: ${err.message}\x1b[0m`);

  if (config.nodeEnv === 'development') {
    console.error(err.stack);
  }

  res.status(err.status || 500).json({
    success: false,
    error:
      config.nodeEnv === 'production'
        ? 'Внутренняя ошибка сервера'
        : err.message,
  });
});

/* ────────────────────────────────────────
   Запуск сервера
   ──────────────────────────────────────── */

let calendarJob = null;
let currentPort = config.port;
let server;

async function startServer() {
  try {
    const { ensureLocalPocketbase } = require('./services/localPocketbase.service');
    await ensureLocalPocketbase();
    const { initPocketBase } = require('./config/pocketbase');
    await initPocketBase();
  } catch (err) {
    console.error('[server] Ошибка инициализации локальной базы данных:', err.message);
  }

  server = app.listen(currentPort, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║        🏠  Платформа аренды — Сервер успешно запущен                 ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log(`║  🌐  Сайт:          http://localhost:${currentPort.toString().padEnd(38)}║`);
    console.log(`║  🔐  Панель админа: http://localhost:${currentPort}/admin`.padEnd(71) + '║');
    console.log(`║  👤  Логин:         ${(config.adminUsername || 'admin').padEnd(48)}║`);
    console.log(`║  🔑  Пароль:        ${(config.adminPassword || 'admin').padEnd(48)}║`);
    if (config.adminPassword === 'admin' || !config.adminPassword) {
      console.log('║                                                                      ║');
      console.log('║  ⚠️   Пароль «admin» временный! Смените его в файле .env             ║');
      console.log('║      перед публикацией сайта в интернете.                            ║');
    }
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    const chatService = require('./services/chat.service');
    const maxService = require('./services/max.service');

    if (!config.disableBackgroundJobs) {
      if (config.maxBotToken) {
        maxService.startMaxPolling(chatService.saveMessage);
      }

      if (config.nodeEnv !== 'production') {
        chatService.startTelegramPolling();
      } else {
        chatService.configureTelegramWebhook().catch((err) => {
          console.error('[server] Ошибка настройки Telegram webhook:', err.message);
          chatService.startTelegramPolling();
        });
      }

      calendarJob = externalCalendarService.startExternalCalendarSync(config.externalCalendarSyncMinutes);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[server] Порт ${currentPort} занят. Пробуем порт ${currentPort + 1}...`);
      currentPort++;
      startServer();
    } else {
      console.error(`[server] Не удалось запустить HTTP-сервер: ${err.message}`);
      process.exitCode = 1;
    }
  });
}

startServer();

function shutdown(signal) {
  console.log(`[server] Получен ${signal}, завершаем активные запросы...`);
  if (calendarJob) calendarJob.stop();
  const forceTimer = setTimeout(() => process.exit(1), 10000);
  forceTimer.unref();
  if (server) {
    server.close(() => {
      clearTimeout(forceTimer);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
