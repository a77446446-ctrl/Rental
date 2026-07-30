const { config } = require('../config/env');
const crypto = require('crypto');
const storageService = require('./storage.service');

const MAX_TIMEOUT_MS = 12000;
const RETRY_DELAYS_MS = [0, 1000, 3000];
const processedMaxUpdateIds = new Set();

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getAbortSignal() {
  return typeof globalThis.AbortSignal?.timeout === 'function'
    ? globalThis.AbortSignal.timeout(MAX_TIMEOUT_MS)
    : undefined;
}

function sanitizeMessageText(text) {
  return String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

function escapeHtml(text) {
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

/**
 * Выполняет сетевой запрос к MAX Bot API
 */
async function callMaxApi(method, payload = {}) {
  if (!config.maxBotToken) {
    console.warn('[MAX] Токен бота МАКС (MAX_BOT_TOKEN) не задан.');
    return false;
  }

  const baseUrl = String(config.maxApiUrl || 'https://platform-api.max.ru').replace(/\/+$/, '');
  const targetId = payload.user_id || payload.chat_id || config.maxChatId;

  if (!targetId) {
    console.warn('[MAX] Target ID (MAX_CHAT_ID) не задан.');
    return false;
  }

  const isMessage = method === 'sendMessage' || method === 'messages';
  const bodyContent = isMessage
    ? {
        text: payload.text,
        ...(payload.attachments ? { attachments: payload.attachments } : {}),
        ...(payload.photo ? { photo: payload.photo } : {})
      }
    : payload;

  const paramCandidates = isMessage
    ? (payload.user_id ? ['user_id', 'chat_id'] : ['chat_id', 'user_id'])
    : [null];

  let lastError = null;

  for (const param of paramCandidates) {
    const url = isMessage
      ? `${baseUrl}/messages?${param}=${encodeURIComponent(targetId)}`
      : `${baseUrl}/${method.replace(/^\/+/, '')}`;

    for (const delayMs of RETRY_DELAYS_MS) {
      if (delayMs) await wait(delayMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': config.maxBotToken
          },
          body: JSON.stringify(bodyContent),
          signal: getAbortSignal(),
        });

        if (response.ok) return true;

        const details = await response.text();
        lastError = new Error(`HTTP ${response.status}: ${details.slice(0, 300)}`);

        if (!response.ok && param) {
          console.warn(`[MAX] Вызов с ?${param}=${targetId} вернул HTTP ${response.status}: ${details.slice(0, 150)}. Пробуем альтернативный параметр...`);
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  console.error('[MAX] Ошибка отправки запроса к API МАКС:', lastError?.message);
  return false;
}

function getMaxWebhookSecret() {
  const explicit = String(config.maxWebhookSecret || '').trim();
  if (explicit) return explicit;
  if (!config.maxBotToken || !config.cookieSecret) return '';
  return crypto
    .createHmac('sha256', config.cookieSecret)
    .update(`max-webhook:${config.maxBotToken}`)
    .digest('hex');
}

function isValidMaxWebhook(providedSecret) {
  const expected = getMaxWebhookSecret();
  const actual = String(providedSecret || '');
  if (!expected || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

const HEX_MAP = {
  '0': '\u200B\u200B', '1': '\u200B\u200C', '2': '\u200B\u200D', '3': '\u200C\u200B',
  '4': '\u200C\u200C', '5': '\u200C\u200D', '6': '\u200D\u200B', '7': '\u200D\u200C',
  '8': '\u200D\u200D', '9': '\uFEFF\u200B', 'a': '\uFEFF\u200C', 'b': '\uFEFF\u200D',
  'c': '\u200B\uFEFF', 'd': '\u200C\uFEFF', 'e': '\u200D\uFEFF', 'f': '\uFEFF\uFEFF',
  '-': '\u200E'
};

const REVERSE_HEX_MAP = {};
for (const [k, v] of Object.entries(HEX_MAP)) REVERSE_HEX_MAP[v] = k;

const INVISIBLE_PREFIX = '\u200B\u200D\uFEFF';
const INVISIBLE_SUFFIX = '\uFEFF\u200D\u200B';

function encodeInvisibleToken(token) {
  if (!token) return '';
  let res = INVISIBLE_PREFIX;
  for (const ch of String(token).toLowerCase()) {
    res += HEX_MAP[ch] || '';
  }
  return res + INVISIBLE_SUFFIX;
}

function extractToken(payloadOrText) {
  const rawStr = typeof payloadOrText === 'string' ? payloadOrText : JSON.stringify(payloadOrText || '');

  // 1. Проверяем невидимый токен
  const start = rawStr.indexOf(INVISIBLE_PREFIX);
  const end = rawStr.indexOf(INVISIBLE_SUFFIX);
  if (start !== -1 && end > start) {
    const hidden = rawStr.slice(start + INVISIBLE_PREFIX.length, end);
    let token = '';
    let i = 0;
    while (i < hidden.length) {
      if (hidden[i] === '\u200E') {
        token += '-';
        i += 1;
      } else {
        const pair = hidden.slice(i, i + 2);
        token += REVERSE_HEX_MAP[pair] || '';
        i += 2;
      }
    }
    if (/^[a-f0-9-]+$/i.test(token)) return token;
  }

  // 2. Фоллбэк на видимый #token:UUID
  const visibleMatch = rawStr.match(/#token:([a-f0-9-]+)/i);
  if (visibleMatch && visibleMatch[1]) return visibleMatch[1];

  return null;
}

/**
 * Отправляет уведомление о новом бронировании в МАКС
 * @param {Object} bookingData - данные о бронировании
 */
async function sendBookingNotification(bookingData) {
  if (!config.maxBotToken || !config.maxChatId) {
    console.warn('[MAX] Токен или Chat ID не заданы. Уведомление в МАКС пропущено.');
    return false;
  }

  const {
    cabinName,
    checkIn,
    checkOut,
    nightsCount,
    totalPrice,
    guestName,
    guestPhone,
    guestTelegram,
    chatToken
  } = bookingData;

  const tokenTag = chatToken
    ? `\n\n💬 Чтобы ответить гостю на сайт, зажмите это сообщение и нажмите «Ответить».\n#token:${chatToken}`
    : '';

  const text = `
🌲 Новое бронирование!

🏡 Домик: ${cabinName}
📅 Даты: ${checkIn} — ${checkOut}
🌙 Ночей: ${nightsCount}
💰 Сумма: ${totalPrice} ₽

👤 Гость: ${guestName}
📞 Телефон: ${guestPhone}
💬 Контакт MAX: ${guestTelegram ? guestTelegram : 'не указан'}${tokenTag}
  `.trim();

  let baseUrlStr = config.baseUrl || 'http://localhost:3000';
  if (!/^https?:\/\//i.test(baseUrlStr)) {
    baseUrlStr = 'https://' + baseUrlStr;
  }
  const adminUrl = new URL('/admin/bookings.html', baseUrlStr).toString();
  const isLocalAdminUrl = /(^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$))/i.test(adminUrl);

  const messagePayload = {
    chat_id: config.maxChatId,
    text: isLocalAdminUrl ? text + '\n\n🔗 Панель админа: ' + adminUrl : text,
  };

  return await callMaxApi('sendMessage', messagePayload);
}

/**
 * Отправляет текстовое сообщение от гостя в МАКС администраторам
 */
async function notifyAdmin(token, text, guestName = null) {
  if (!config.maxBotToken || !config.maxChatId) {
    return false;
  }

  const alias = guestName ? `от: ${guestName}` : `(Гость ${token.split('-')[0]})`;

  const messageText = `
💬 Новое сообщение из чата ${alias}

${text}

💬 Чтобы ответить гостю, зажмите это сообщение и нажмите «Ответить».
#token:${token}
  `.trim();

  return await callMaxApi('sendMessage', {
    chat_id: config.maxChatId,
    text: messageText,
  });
}

/**
 * Извлекает вложение (фото/видео/аудио/файл), переданное администратором в МАКС
 */
function extractMaxAttachment(msg) {
  if (!msg || typeof msg !== 'object') return null;

  const attachments = msg.attachments || msg.body?.attachments || msg.link?.message?.attachments || [];
  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const att of attachments) {
      const url = att.payload?.url || att.url || att.photo_url || att.file_url || att.video_url || att.src;
      const type = String(att.type || att.media_type || '').toLowerCase();
      if (url) {
        return {
          kind: 'attachment',
          mediaType: type.includes('video') ? 'video' : (type.includes('audio') ? 'audio' : 'image'),
          url: url,
          name: att.name || att.payload?.name || (type.includes('video') ? 'video.mp4' : 'file.jpg')
        };
      }
    }
  }

  const video = msg.video || msg.body?.video;
  if (video) {
    const target = Array.isArray(video) ? video[video.length - 1] : video;
    const url = typeof target === 'string' ? target : (target.url || target.file_url || target.src || target.href);
    if (url) {
      return {
        kind: 'attachment',
        mediaType: 'video',
        url: url,
        name: target.name || 'video.mp4'
      };
    }
  }

  const photo = msg.photo || msg.image || msg.file || msg.body?.photo || msg.body?.image;
  if (photo) {
    const target = Array.isArray(photo) ? photo[photo.length - 1] : photo;
    const url = typeof target === 'string' ? target : (target.url || target.file_url || target.src || target.href);
    if (url) {
      return {
        kind: 'attachment',
        mediaType: 'image',
        url: url,
        name: target.name || 'photo.jpg'
      };
    }
  }

  return null;
}

/**
 * Загружает вложение из МАКС в Supabase Storage, возвращая публичный URL
 */
async function uploadMaxAttachment(maxAttachment) {
  if (!maxAttachment || !maxAttachment.url) return null;

  // Если URL уже находится в хранилище Supabase
  if (maxAttachment.url.includes('supabase.co') || maxAttachment.url.includes('/storage/v1/')) {
    return maxAttachment;
  }

  try {
    const storageService = require('./storage.service');
    let response = await fetch(maxAttachment.url);
    if (!response.ok && config.maxBotToken) {
      response = await fetch(maxAttachment.url, {
        headers: { 'Authorization': config.maxBotToken }
      });
    }

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = response.headers.get('content-type') || (maxAttachment.mediaType === 'video' ? 'video/mp4' : 'image/jpeg');

      const uploaded = await storageService.uploadChatAttachment(buffer, maxAttachment.name || (maxAttachment.mediaType === 'video' ? 'video.mp4' : 'photo.jpg'), mimeType);
      return {
        kind: 'attachment',
        mediaType: uploaded.mediaType || maxAttachment.mediaType || 'image',
        url: uploaded.url,
        name: maxAttachment.name || 'file'
      };
    }
  } catch (err) {
    console.warn('[MAX] Попытка скачивания напрямую сбоила, включается прокси:', err.message);
  }

  // Если прямая загрузка в Supabase сбоила, оборачиваем в наш роутер-прокси
  const proxyUrl = `/api/chat/max-media?url=${encodeURIComponent(maxAttachment.url)}`;
  return {
    kind: 'attachment',
    mediaType: maxAttachment.mediaType || 'image',
    url: proxyUrl,
    name: maxAttachment.name || 'file'
  };
}

/**
 * Отправляет вложение от гостя в МАКС администраторам
 */
async function notifyAdminAttachment(token, attachment, guestName = null) {
  if (!config.maxBotToken || !config.maxChatId) {
    return false;
  }

  const alias = guestName ? `от: ${guestName}` : `(Гость ${token.split('-')[0]})`;
  const label = attachmentLabel(attachment);
  const caption = `
💬 Новое ${label.toLowerCase()} из чата ${alias}

💬 Чтобы ответить гостю, зажмите это сообщение и нажмите «Ответить».
#token:${token}
  `.trim();

  const attType = attachment.mediaType === 'image' ? 'image' : 'file';

  return await callMaxApi('sendMessage', {
    chat_id: config.maxChatId,
    text: caption,
    attachments: [
      {
        type: attType,
        payload: { url: attachment.url }
      }
    ]
  });
}

/**
 * Обрабатывает вебхук от МАКС при ответе администратора
 * @param {Object} payload - тело запроса от МАКС
 * @param {Function} saveMessageFn - функция сохранения сообщения в базу
 */
async function handleMaxWebhook(payload, saveMessageFn) {
  if (!payload || typeof payload !== 'object') return;

  const updateId = payload.update_id || payload.id;
  if (updateId) {
    if (processedMaxUpdateIds.has(updateId)) return;
    processedMaxUpdateIds.add(updateId);
    if (processedMaxUpdateIds.size > 200) {
      processedMaxUpdateIds.delete(processedMaxUpdateIds.values().next().value);
    }
  }

  const msg = payload.message || payload.data || payload;
  const textRaw = msg.text || msg.body?.text || msg.caption || '';
  const senderId = msg.sender?.user_id || msg.sender?.id || msg.chat_id || msg.user_id;

  // Если кто-то пишет боту команду /id или "айди", бот автоматически сообщает его MAX ID
  if (/^\/?(id|айди|myid)$/i.test(textRaw.trim()) && senderId) {
    await callMaxApi('sendMessage', {
      user_id: senderId,
      text: `👤 Ваш MAX ID: ${senderId}\n\nУкажите это значение в переменной MAX_CHAT_ID.`
    });
    return;
  }

  // Ищем токен чата во всех возможных местах цитируемого/прикрепеленного сообщения MAX
  const quotedContext = msg.reply_to_message ||
    msg.replyTo ||
    msg.link ||
    msg.quoted_message ||
    msg.body?.link ||
    payload;

  const chatToken = extractToken(quotedContext);
  if (!chatToken) {
    return;
  }

  // 1. Проверяем вложения (картинка/видео/файл), присланные администратором из МАКС
  const rawAttachment = extractMaxAttachment(msg);
  if (rawAttachment && typeof saveMessageFn === 'function') {
    const uploadedAttachment = await uploadMaxAttachment(rawAttachment);
    if (uploadedAttachment) {
      await saveMessageFn(chatToken, JSON.stringify(uploadedAttachment), 'admin');
    }
  }

  // 2. Сохраняем текстовый ответ (или подпись к фото)
  const replyText = textRaw;
  if (replyText && typeof saveMessageFn === 'function') {
    const sanitized = sanitizeMessageText(replyText);
    await saveMessageFn(chatToken, sanitized, 'admin');
  }
}

/**
 * Запускает Long Polling для МАКС бота (полезно для локальной разработки)
 */
let maxPollingStarted = false;
function startMaxPolling(saveMessageFn) {
  if (!config.maxBotToken) return;
  if (maxPollingStarted) return;
  maxPollingStarted = true;

  console.log('🤖 Запущен локальный Polling МАКС бота...');

  async function poll() {
    try {
      const baseUrl = String(config.maxApiUrl || 'https://platform-api.max.ru').replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/updates`, {
        headers: { 'Authorization': config.maxBotToken }
      });
      const json = await response.json();

      if (json && Array.isArray(json.updates) && json.updates.length > 0) {
        for (const update of json.updates) {
          await handleMaxWebhook(update, saveMessageFn);
        }
      }
    } catch (err) {
      // Игнорируем сетевые ошибки при поллинге
    }

    setTimeout(poll, 2000);
  }

  poll();
}

module.exports = {
  callMaxApi,
  sendBookingNotification,
  notifyAdmin,
  notifyAdminAttachment,
  handleMaxWebhook,
  isValidMaxWebhook,
  getMaxWebhookSecret,
  startMaxPolling,
};
