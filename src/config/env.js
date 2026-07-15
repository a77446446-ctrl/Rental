/**
 * Конфигурация переменных окружения.
 * Загружает .env файл и предоставляет единую точку доступа
 * ко всем переменным окружения с валидацией обязательных значений.
 */

const dotenv = require('dotenv');
const path = require('path');

/* Загружаем .env из корня проекта */
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  /* Общие настройки сервера */
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  /* Supabase */
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'cabin-photos',

  /* Авторизация администратора */
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  cookieSecret: process.env.COOKIE_SECRET || '',
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS, 10) || 12,

  /* Telegram-уведомления */
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',

  /* Внешние iCal-календари */
  externalCalendarSyncMinutes: parseInt(process.env.EXTERNAL_CALENDAR_SYNC_MINUTES, 10) || 30,
  disableBackgroundJobs: process.env.DISABLE_BACKGROUND_JOBS === 'true',
};

/**
 * Проверяет наличие обязательных переменных окружения.
 * При отсутствии критических переменных выводит предупреждение в консоль.
 * В продакшен-режиме выбрасывает ошибку и останавливает запуск.
 */
function validateEnv() {
  const required = [
    { key: 'SUPABASE_URL', value: config.supabaseUrl },
    { key: 'SUPABASE_ANON_KEY', value: config.supabaseAnonKey },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: config.supabaseServiceRoleKey },
    { key: 'ADMIN_PASSWORD', value: config.adminPassword },
    { key: 'COOKIE_SECRET', value: config.cookieSecret },
  ];

  const missing = required.filter((item) => !item.value);

  if (missing.length > 0) {
    const names = missing.map((item) => item.key).join(', ');

    if (config.nodeEnv === 'production') {
      throw new Error(
        `[env] Отсутствуют обязательные переменные окружения: ${names}. ` +
        'Заполните .env или добавьте их в Railway.'
      );
    }

    console.warn(
      `\x1b[33m[env] Предупреждение: не заданы переменные окружения: ${names}.\x1b[0m`
    );
    console.warn(
      '\x1b[33m[env] Скопируйте .env.example → .env и заполните значения.\x1b[0m'
    );
  }
}

module.exports = { config, validateEnv };
