/**
 * Middleware для ограничения частоты запросов (Rate Limiting).
 * Защищает API от перебора и спама.
 * Экспортирует три лимитера для разных уровней защиты:
 * - generalLimiter: общий лимит для всех маршрутов
 * - apiLimiter: усиленный лимит для API-маршрутов
 * - authLimiter: строгий лимит для маршрутов авторизации
 */

const rateLimit = require('express-rate-limit');

// Функция для пропуска лимитов при локальной разработке
const skipLocalRequests = (req) => {
  return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
};

/**
 * Общий лимитер для всех маршрутов.
 * 200 запросов за 15 минут с одного IP.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много запросов. Пожалуйста, подождите 15 минут.',
  },
  skip: skipLocalRequests,
});

/**
 * Лимитер для API-маршрутов.
 * 100 запросов за 15 минут с одного IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Превышен лимит запросов к API. Попробуйте позже.',
  },
  skip: skipLocalRequests,
});

/**
 * Строгий лимитер для маршрутов авторизации.
 * 10 попыток за 15 минут с одного IP — защита от brute-force.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много попыток входа. Подождите 15 минут.',
  },
  skip: skipLocalRequests,
});

/**
 * Отдельный лимит для тяжёлых публичных загрузок чата.
 * Не позволяет одному адресу быстро заполнить публичное хранилище.
 */
const chatUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Слишком много загрузок. Попробуйте позже.',
  },
  skip: skipLocalRequests,
});

module.exports = { generalLimiter, apiLimiter, authLimiter, chatUploadLimiter };
