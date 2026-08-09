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
const { supabaseAdmin } = require('./config/supabase');

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
          return res.status(503).send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Техническое обслуживание</title>
  <link rel="icon" href="/api/icon.png">
  <link rel="apple-touch-icon" sizes="192x192" href="/api/pwa-icon/192.png">
  <link rel="stylesheet" href="/css/main.css">
  <style>
    body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; background:#121212 !important; color:#EDE4D6; font-family:'Helvetica Neue', sans-serif; text-align:center; padding:20px; box-sizing:border-box; }
    h1 { font-size:32px; font-weight:300; margin-bottom:10px; }
    p { font-size:16px; opacity:0.7; line-height:1.5; }
    /* Скрываем всё лишнее от main.css */
    header, footer, main, nav, .hero, .section { display:none !important; }
  </style>
</head>
<body>
  <h1>Сайт на техническом обслуживании</h1>
  <p>Мы проводим плановые работы.<br>Пожалуйста, зайдите позже.</p>

  <!-- Чат виджет -->
  <div id="chat-widget" class="chat-widget">
    <span id="chat-badge" class="chat-badge" style="display: none;">0</span>
    <div class="chat-header" id="chat-header">
      <span>Связаться с нами</span>
      <button type="button" id="chat-toggle" aria-label="Открыть чат">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>
      </button>
    </div>
    <div class="chat-body" id="chat-body" style="display: none;">
      <div class="chat-messages" id="chat-messages"></div>
      <form class="chat-form" id="chat-form">
        <input type="file" id="chat-file-input" accept="image/*,video/*,audio/*" hidden>
        <button type="button" class="chat-attach-btn" id="chat-attach-btn" title="Прикрепить файл">＋</button>
        <input type="text" id="chat-input" placeholder="Введите сообщение..." autocomplete="off">
        <button type="submit">➤</button>
      </form>
    </div>
  </div>

  <div id="chat-toast-banner" class="chat-toast-banner" style="display: none;">
    💬 Ответ от администратора: вам новое сообщение!
  </div>
  <div id="toast-container" class="toast-container"></div>

  <script src="/js/chat.js"></script>
</body>
</html>
          `);
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
  if (!supabaseAdmin) return res.status(503).json({ status: 'not_ready', database: false, migration_006: false });
  const [database, migration] = await Promise.all([
    supabaseAdmin.from('cabins').select('id', { head: true, count: 'exact' }).limit(1),
    supabaseAdmin.from('app_config').select('key', { head: true, count: 'exact' }).limit(1),
  ]);
  const ready = !database.error && !migration.error;
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    database: !database.error,
    migration_006: !migration.error,
  });
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

    if (!config.disableBackgroundJobs) {
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
