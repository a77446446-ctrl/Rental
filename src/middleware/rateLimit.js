/**
 * Middleware для ограничения частоты запросов (Rate Limiting).
 * Защищает API от перебора и спама.
 * Ограничения применяются только к чувствительным операциям:
 * - authLimiter: строгий лимит для маршрутов авторизации
 * - chatUploadLimiter: лимит для тяжёлых публичных загрузок
 *
 * Обычные страницы, статические файлы и публичные GET API намеренно
 * не ограничиваются, чтобы активная работа с сайтом не приводила к HTTP 429.
 */

const rateLimit = require('express-rate-limit');

// Функция для пропуска лимитов при локальной разработке
const skipLocalRequests = (req) => {
  return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
};

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

module.exports = { authLimiter, chatUploadLimiter };
