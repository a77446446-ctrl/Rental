const express = require('express');
const multer = require('multer');
const router = express.Router();
const chatService = require('../services/chat.service');
const maxService = require('../services/max.service');
const { config } = require('../config/env');
const storageService = require('../services/storage.service');
const { cleanText, validateUuid } = require('../utils/validation');
const { chatUploadLimiter } = require('../middleware/rateLimit');

const CHAT_FILE_LIMIT = 50 * 1024 * 1024;
const CHAT_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_FILE_LIMIT, files: 1 },
  fileFilter: (_req, file, callback) => {
    let allowed = CHAT_MIME_PREFIXES.some((prefix) => file.mimetype && file.mimetype.startsWith(prefix));
    if (!allowed && file.originalname) {
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (['mp4', 'mov', 'webm', 'ogg', 'mp3', 'm4a', 'wav', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) {
        allowed = true;
      }
    }
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
      transport: 'polling',
      pollingIntervalMs: 15000,
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

    // Каналы уведомлений независимы: ошибка одного не блокирует второй.
    chatService.notifyAdmin(token, safeMessage).catch(err => {
      console.error('[chat.routes] Ошибка фоновой отправки в Telegram:', err);
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
router.post('/upload', chatUploadLimiter, (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: 'Размер файла превышает лимит (50 МБ)' });
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

    const uploaded = await storageService.uploadChatAttachment(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const attachment = {
      kind: 'attachment',
      mediaType: uploaded.mediaType,
      url: uploaded.url,
      name: req.file.originalname,
      mimeType: uploaded.mimeType,
    };

    const payload = JSON.stringify(attachment);

    const savedMsg = await chatService.saveMessage(token, payload, 'guest');

    chatService.notifyAdminAttachment(token, attachment).catch(err => {
      console.error('[chat.routes] Ошибка фоновой отправки вложения в Telegram:', err);
    });


    res.json({ success: true, data: savedMsg });
  } catch (error) {
    console.error('[chat.routes] POST /upload error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode === 400 ? error.message : 'Ошибка сервера при загрузке файла',
    });
  }
});

/**
 * POST /api/chat/webhook
 * Webhook для приема ответов от Telegram
 */
router.post('/webhook', async (req, res) => {
  try {
    if (!chatService.isValidTelegramWebhook(req.get('x-telegram-bot-api-secret-token'))) {
      return res.status(401).json({ success: false, error: 'Неверная подпись webhook' });
    }
    res.sendStatus(200);
    await chatService.handleTelegramWebhook(req.body);
  } catch (error) {
    console.error('[chat.routes] POST /webhook error:', error);
  }
});

/**
 * POST /api/chat/max-webhook
 * Webhook для приема ответов от МАКС (MAX Bot API)
 */
router.post('/max-webhook', async (req, res) => {
  try {
    const providedSecret = req.get('x-max-bot-api-secret-token') || req.get('authorization')?.replace(/^Bearer\s+/i, '') || req.query.secret;
    if (!maxService.isValidMaxWebhook(providedSecret)) {
      return res.status(401).json({ success: false, error: 'Неверная подпись webhook МАКС' });
    }

    res.sendStatus(200);

    await maxService.handleMaxWebhook(req.body, chatService.saveMessage);
  } catch (error) {
    console.error('[chat.routes] POST /max-webhook error:', error);
  }
});

/**
 * GET /api/chat/max-media
 * Проксирует заблокированные/защищенные медиафайлы из МАКС в браузер гостя
 */
router.get('/max-media', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl || !maxService.isTrustedMaxMediaUrl(rawUrl)) {
      return res.status(400).send('Некорректный URL');
    }

    const headers = {};
    if (config.maxBotToken && rawUrl.includes('max.ru')) {
      headers['Authorization'] = config.maxBotToken;
    }

    let response = await fetch(rawUrl, { headers });
    if (!response.ok && headers['Authorization']) {
      response = await fetch(rawUrl);
    }

    if (!response.ok) {
      return res.status(response.status).send('Ошибка загрузки файла');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[chat.routes] GET /max-media error:', err);
    return res.status(500).send('Ошибка проксирования файла');
  }
});

module.exports = router;
