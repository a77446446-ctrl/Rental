const express = require('express');
const multer = require('multer');
const router = express.Router();
const chatService = require('../services/chat.service');
const { config } = require('../config/env');
const storageService = require('../services/storage.service');
const { cleanText, validateUuid } = require('../utils/validation');

const CHAT_FILE_LIMIT = 15 * 1024 * 1024;
const CHAT_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_FILE_LIMIT, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = CHAT_MIME_PREFIXES.some((prefix) => file.mimetype && file.mimetype.startsWith(prefix));
    callback(allowed ? null : new Error('UNSUPPORTED_CHAT_FILE'), allowed);
  },
});

/**
 * GET /api/chat/config
 * Отдает публичные ключи Supabase для настройки Realtime на клиенте
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey
    }
  });
});

/**
 * GET /api/chat/messages/:token
 * Получает историю сообщений для конкретного гостя по токену
 */
router.get('/messages/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Простая валидация UUID v4
    try {
      validateUuid(token, 'Токен чата');
    } catch (_error) {
      return res.status(400).json({ success: false, error: 'Неверный формат токена' });
    }

    const messages = await chatService.getChatHistory(token);
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('[chat.routes] GET /messages error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

/**
 * POST /api/chat/messages
 * Отправка сообщения от гостя
 */
router.post('/messages', async (req, res) => {
  try {
    const { token, message } = req.body;

    validateUuid(token, 'Токен чата');
    const safeMessage = cleanText(message, { field: 'Сообщение', required: true, max: 2000 });

    // Сохраняем сообщение в базу
    const savedMsg = await chatService.saveMessage(token, safeMessage, 'guest');

    // Асинхронно отправляем уведомление админу в ТГ (не ждем завершения)
    chatService.notifyAdmin(token, safeMessage).catch(err => {
      console.error('[chat.routes] Ошибка фоновой отправки в ТГ:', err);
    });

    res.json({
      success: true,
      data: savedMsg
    });
  } catch (error) {
    console.error('[chat.routes] POST /messages error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера при отправке сообщения' });
  }
});

/**
 * POST /api/chat/upload
 * Отправка изображения, видео или аудио от гостя.
 */
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: 'Размер файла превышает лимит (15 МБ)' });
    } else if (err) {
      const unsupported = err.message === 'UNSUPPORTED_CHAT_FILE';
      return res.status(unsupported ? 400 : 500).json({
        success: false,
        error: unsupported ? 'Можно загрузить только изображение, видео или аудио' : 'Ошибка загрузки файла'
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { token } = req.body;
    try {
      validateUuid(token, 'Токен чата');
    } catch (_error) {
      return res.status(400).json({ success: false, error: 'Неверный формат токена' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не передан' });
    }

    const url = await storageService.uploadChatAttachment(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const mediaType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
        ? 'video'
        : 'audio';

    const attachment = {
      kind: 'attachment',
      mediaType,
      url,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
    };

    const payload = JSON.stringify(attachment);

    const savedMsg = await chatService.saveMessage(token, payload, 'guest');

    chatService.notifyAdminAttachment(token, attachment).catch(err => {
      console.error('[chat.routes] Ошибка фоновой отправки вложения в ТГ:', err);
    });

    res.json({ success: true, data: savedMsg });
  } catch (error) {
    console.error('[chat.routes] POST /upload error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка сервера при загрузке файла' });
  }
});

/**
 * POST /api/chat/webhook
 * Webhook для приема ответов от Telegram
 */
router.post('/webhook', async (req, res) => {
  try {
    // В ответ на вебхук от ТГ всегда нужно быстро отдавать 200 OK, 
    // чтобы Telegram не пытался отправлять сообщение повторно
    res.sendStatus(200);

    // Обрабатываем сообщение в фоне
    await chatService.handleTelegramWebhook(req.body);
  } catch (error) {
    console.error('[chat.routes] POST /webhook error:', error);
  }
});

module.exports = router;
