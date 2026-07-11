const { supabaseAdmin } = require('../config/supabase');
const { config } = require('../config/env');
const storageService = require('./storage.service');

/**
 * Сервис для работы с чатом поддержки
 */

function sanitizeMessageText(text) {
  return String(text || '').replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
}

function escapeTelegramHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attachmentLabel(attachment) {
  if (attachment.mediaType === 'image') return 'Фото';
  if (attachment.mediaType === 'video') return 'Видео';
  if (attachment.mediaType === 'audio') return 'Аудио';
  return 'Файл';
}

async function callTelegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error('[chat.service] Ошибка Telegram API:', await response.text());
    return false;
  }

  return true;
}

/**
 * Сохраняет сообщение в базу данных.
 * @param {string} token - UUID чата (от гостя)
 * @param {string} text - Текст сообщения
 * @param {string} sender - Отправитель ('guest' или 'admin')
 */
async function saveMessage(token, text, sender = 'guest') {
  // Базовая санитизация (удаляем HTML теги, чтобы избежать XSS)
  const sanitizedText = sanitizeMessageText(text);

  if (!sanitizedText) {
    throw new Error('Message cannot be empty');
  }

  const { data, error } = await supabaseAdmin
    .from('chat_logs')
    .insert([{
      chat_token: token,
      sender_type: sender,
      message: sanitizedText,
      is_read: sender === 'admin' // Если пишет админ, гость пока не прочитал. Если гость - админ не прочитал.
    }])
    .select()
    .single();

  if (error) {
    console.error('[chat.service] Ошибка при сохранении сообщения:', error.message);
    throw new Error('Не удалось сохранить сообщение');
  }

  return data;
}

/**
 * Отправляет сообщение от гостя в Telegram администратору.
 * @param {string} token - UUID чата
 * @param {string} text - Текст сообщения
 */
async function notifyAdmin(token, text) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn('[Telegram] Токен или Chat ID не заданы. Сообщение чата не отправлено в ТГ.');
    return false;
  }

  const sanitizedText = escapeTelegramHtml(text).trim();

  const tgMessage = `
💬 <b>Новое сообщение из чата</b>

${sanitizedText}

<i>(Чтобы ответить гостю, сделайте Reply / Ответить на это сообщение)</i>
<span class="tg-spoiler">#token:${token}</span>
  `.trim();

  try {
    return await callTelegram('sendMessage', {
      chat_id: config.telegramChatId,
      text: tgMessage,
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('[chat.service] Исключение при отправке в ТГ:', err.message);
    return false;
  }
}

async function notifyAdminAttachment(token, attachment) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn('[Telegram] Токен или Chat ID не заданы. Вложение чата не отправлено в ТГ.');
    return false;
  }

  const caption = `
💬 <b>Новое вложение из чата</b>

${escapeTelegramHtml(attachmentLabel(attachment))}: ${escapeTelegramHtml(attachment.name || 'файл')}

<i>(Чтобы ответить гостю, сделайте Reply / Ответить на это сообщение)</i>
<span class="tg-spoiler">#token:${token}</span>
  `.trim();

  const common = {
    chat_id: config.telegramChatId,
    caption,
    parse_mode: 'HTML'
  };

  try {
    if (attachment.mediaType === 'image') {
      return await callTelegram('sendPhoto', { ...common, photo: attachment.url });
    }
    if (attachment.mediaType === 'video') {
      return await callTelegram('sendVideo', { ...common, video: attachment.url });
    }
    if (attachment.mediaType === 'audio') {
      return await callTelegram('sendAudio', { ...common, audio: attachment.url });
    }

    return await callTelegram('sendDocument', { ...common, document: attachment.url });
  } catch (err) {
    console.error('[chat.service] Исключение при отправке вложения в ТГ:', err.message);
    return false;
  }
}

function getTelegramAttachment(message) {
  if (message.photo && message.photo.length > 0) {
    const photo = message.photo[message.photo.length - 1];
    return {
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      mediaType: 'image',
      mimeType: 'image/jpeg',
      name: 'telegram-photo.jpg'
    };
  }

  if (message.video) {
    return {
      fileId: message.video.file_id,
      fileUniqueId: message.video.file_unique_id,
      mediaType: 'video',
      mimeType: message.video.mime_type || 'video/mp4',
      name: message.video.file_name || 'telegram-video.mp4'
    };
  }

  if (message.voice) {
    return {
      fileId: message.voice.file_id,
      fileUniqueId: message.voice.file_unique_id,
      mediaType: 'audio',
      mimeType: message.voice.mime_type || 'audio/ogg',
      name: 'telegram-voice.ogg'
    };
  }

  if (message.audio) {
    return {
      fileId: message.audio.file_id,
      fileUniqueId: message.audio.file_unique_id,
      mediaType: 'audio',
      mimeType: message.audio.mime_type || 'audio/mpeg',
      name: message.audio.file_name || 'telegram-audio.mp3'
    };
  }

  if (message.document && message.document.mime_type) {
    const mimeType = message.document.mime_type;
    if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      return {
        fileId: message.document.file_id,
        fileUniqueId: message.document.file_unique_id,
        mediaType: mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('video/') ? 'video' : 'audio',
        mimeType,
        name: message.document.file_name || 'telegram-file'
      };
    }
  }

  return null;
}

async function uploadTelegramAttachment(telegramAttachment) {
  const fileInfoResponse = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getFile?file_id=${encodeURIComponent(telegramAttachment.fileId)}`);
  const fileInfo = await fileInfoResponse.json();

  if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
    throw new Error('Не удалось получить файл из Telegram');
  }

  const fileResponse = await fetch(`https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.result.file_path}`);
  if (!fileResponse.ok) {
    throw new Error('Не удалось скачать файл из Telegram');
  }

  const arrayBuffer = await fileResponse.arrayBuffer();
  const url = await storageService.uploadChatAttachment(
    Buffer.from(arrayBuffer),
    telegramAttachment.name,
    telegramAttachment.mimeType
  );

  return {
    kind: 'attachment',
    mediaType: telegramAttachment.mediaType,
    url,
    name: telegramAttachment.name,
    mimeType: telegramAttachment.mimeType,
    telegramFileUniqueId: telegramAttachment.fileUniqueId
  };
}

async function hasRecentDuplicate(chatToken, message) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  let query = supabaseAdmin
    .from('chat_logs')
    .select('id')
    .eq('chat_token', chatToken)
    .eq('sender_type', 'admin')
    .gte('created_at', twoMinutesAgo)
    .limit(1);

  const mediaUniqueId = message.telegramFileUniqueId || message.fileUniqueId;
  if (mediaUniqueId) {
    query = query.ilike('message', `%${mediaUniqueId}%`);
  } else {
    query = query.eq('message', message.text);
  }

  const { data } = await query;
  return data && data.length > 0;
}

/**
 * Обрабатывает вебхук от Telegram.
 * Если это Reply на сообщение бота из чата, сохраняет ответ админа в БД.
 * @param {Object} payload - Тело запроса от Telegram
 */
async function handleTelegramWebhook(payload) {
  if (payload.update_id && processedUpdateIds.has(payload.update_id)) {
    return;
  }
  if (payload.update_id) {
    processedUpdateIds.add(payload.update_id);
    if (processedUpdateIds.size > 200) {
      processedUpdateIds.delete(processedUpdateIds.values().next().value);
    }
  }

  if (!payload.message) {
    return;
  }

  const msg = payload.message;
  const originalText = msg.reply_to_message
    ? (msg.reply_to_message.text || msg.reply_to_message.caption || '')
    : '';
  const tokenMatch = originalText.match(/#token:([a-f0-9-]+)/i);

  if (!tokenMatch || !tokenMatch[1]) {
    return;
  }

  const chatToken = tokenMatch[1];

  if (msg.text) {
    const sanitizedReply = sanitizeMessageText(msg.text);
    if (await hasRecentDuplicate(chatToken, { text: sanitizedReply })) {
      return;
    }
    await saveMessage(chatToken, sanitizedReply, 'admin');
    return;
  }

  const telegramAttachment = getTelegramAttachment(msg);
  if (!telegramAttachment) {
    return;
  }

  if (telegramAttachment.fileUniqueId && await hasRecentDuplicate(chatToken, telegramAttachment)) {
    return;
  }

  const attachment = await uploadTelegramAttachment(telegramAttachment);
  await saveMessage(chatToken, JSON.stringify(attachment), 'admin');
}

/**
 * Получает историю чата по токену
 * @param {string} token - UUID чата
 */
async function getChatHistory(token) {
  const { data, error } = await supabaseAdmin
    .from('chat_logs')
    .select('id, sender_type, message, created_at')
    .eq('chat_token', token)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[chat.service] Ошибка при получении истории:', error.message);
    throw new Error('Не удалось получить историю чата');
  }

  return data || [];
}

/**
 * Запускает Long Polling для Telegram бота (полезно для локальной разработки без Webhook)
 */
let lastUpdateId = 0;
let pollingStarted = false;
const processedUpdateIds = new Set();
function startTelegramPolling() {
  if (!config.telegramBotToken) return;
  if (pollingStarted) return;
  pollingStarted = true;

  console.log('🤖 Запущен локальный Polling Telegram бота...');

  async function poll() {
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
      const json = await response.json();

      if (json.ok && json.result.length > 0) {
        for (const update of json.result) {
          lastUpdateId = update.update_id;
          await handleTelegramWebhook(update);
        }
      }
    } catch (err) {
      // Игнорируем сетевые ошибки при поллинге
    }

    // Запускаем следующий цикл
    setTimeout(poll, 1000);
  }

  poll();
}

module.exports = {
  saveMessage,
  notifyAdmin,
  notifyAdminAttachment,
  handleTelegramWebhook,
  getChatHistory,
  startTelegramPolling
};
