/**
 * Точка входа приложения eco-gorniy.ru
 * Настраивает Express-сервер: безопасность, парсинг, статика, маршруты, healthcheck.
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { config, validateEnv } = require('./config/env');
const publicRoutes = require('./routes/public.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');
const { router: mediaRoutes } = require('./routes/media.routes');
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
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://api-maps.yandex.ru", "https://yastatic.net"],
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
          "https://api-maps.yandex.ru"
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
          "https://*.maps.yandex.net",
          "https://core-renderer-tiles.maps.yandex.net"
        ],
        frameSrc: [
          "'self'", 
          "https://www.youtube.com", 
          "https://player.vimeo.com", 
          "https://vk.com",
          "https://vkvideo.ru"
        ],
        objectSrc: ["'none'"],
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

/* ────────────────────────────────────────
   API-маршруты
   ──────────────────────────────────────── */

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
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
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

function startServer() {
  server = app.listen(currentPort, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║        🌲  EcoGorniy.ru — Сервер запущен     ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Адрес:      http://localhost:${currentPort.toString().padEnd(15)}║`);
    console.log(`║  Режим:      ${config.nodeEnv.padEnd(32)}║`);
    console.log(`║  Healthcheck: ${(config.baseUrl + '/health').padEnd(31)}║`);
    console.log('╚══════════════════════════════════════════════╝');
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
