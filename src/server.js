/**
 * Точка входа приложения eco-gorniy.ru
 * Настраивает Express-сервер: безопасность, парсинг, статика, маршруты, healthcheck.
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { config, validateEnv } = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimit');
const publicRoutes = require('./routes/public.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');
const { requireAdmin } = require('./middleware/auth');
const externalCalendarService = require('./services/externalCalendar.service');

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

/* ────────────────────────────────────────
   Rate Limiting
   ──────────────────────────────────────── */

app.use(generalLimiter);

/* Для Railway: доверять прокси, чтобы rate-limiter видел реальный IP */
app.set('trust proxy', 1);

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
   Статические файлы
   ──────────────────────────────────────── */

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    extensions: ['html'],
    maxAge: config.nodeEnv === 'production' ? '1d' : 0,
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

/* ────────────────────────────────────────
   API-маршруты
   ──────────────────────────────────────── */

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

app.listen(config.port, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║        🌲  EcoGorniy.ru — Сервер запущен     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Адрес:      ${config.baseUrl.padEnd(32)}║`);
  console.log(`║  Режим:      ${config.nodeEnv.padEnd(32)}║`);
  console.log(`║  Healthcheck: ${(config.baseUrl + '/health').padEnd(31)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  
  // Запускаем polling Telegram только локально. В production лучше использовать webhook.
  if (config.nodeEnv !== 'production') {
    const chatService = require('./services/chat.service');
    chatService.startTelegramPolling();
  }

  externalCalendarService.startExternalCalendarSync(config.externalCalendarSyncMinutes);
});

module.exports = app;
