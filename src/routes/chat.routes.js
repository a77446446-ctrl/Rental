const express = require('express');
const multer = require('multer');
const router = express.Router();
const chatService = require('../services/chat.service');
const { config } = require('../config/env');
const storageService = require('../services/storage.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
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

    if (!token || !message) {
      return res.status(400).json({ success: false, error: 'Отсутствует токен или текст сообщения' });
    }

    // Сохраняем сообщение в базу
    const savedMsg = await chatService.saveMessage(token, message, 'guest');

    // Асинхронно отправляем уведомление админу в ТГ (не ждем завершения)
    chatService.notifyAdmin(token, message).catch(err => {
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
      return res.status(400).json({ success: false, error: 'Размер файла превышает лимит (50 МБ)' });
    } else if (err) {
      return res.status(500).json({ success: false, error: 'Ошибка загрузки файла' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { token } = req.body;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!token || !uuidRegex.test(token)) {
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
