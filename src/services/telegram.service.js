const { config } = require('../config/env');

const TELEGRAM_TIMEOUT_MS = 12000;
const RETRY_DELAYS_MS = [0, 1000, 3000];

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getAbortSignal() {
  return typeof globalThis.AbortSignal?.timeout === 'function'
    ? globalThis.AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
    : undefined;
}

async function postTelegram(url, headers, payload) {
  let lastError = null;

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs) await wait(delayMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: getAbortSignal(),
      });

      if (response.ok) return true;

      const details = await response.text();
      lastError = new Error(`HTTP ${response.status}: ${details.slice(0, 300)}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Не удалось отправить уведомление');
}

function getRelayEndpoint() {
  const relayUrl = String(config.telegramRelayUrl || '').trim();
  const relaySecret = String(config.telegramRelaySecret || '').trim();
  if (!relayUrl && !relaySecret) return null;
  if (!relayUrl || !relaySecret) {
    throw new Error('TELEGRAM_RELAY_URL и TELEGRAM_RELAY_SECRET должны быть заданы вместе');
  }

  const parsed = new URL(relayUrl);
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('TELEGRAM_RELAY_URL должен использовать HTTPS');
  }

  return `${relayUrl.replace(/\/+$/, '')}/telegram/sendMessage`;
}

/**
 * Отправляет уведомление о новом бронировании в Telegram
 * @param {Object} bookingData - данные о брони
 * @returns {Promise<boolean>} true, если отправлено успешно
 */
async function sendBookingNotification(bookingData) {
  if ((!config.telegramBotToken && !config.telegramRelayUrl) || !config.telegramChatId) {
    console.warn('[Telegram] Токен/ретранслятор или Chat ID не заданы. Уведомление пропущено.');
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
    guestTelegram
  } = bookingData;

  const text = `
🌲 <b>Новое бронирование!</b>

<b>Домик:</b> ${cabinName}
<b>Даты:</b> ${checkIn} — ${checkOut}
<b>Ночей:</b> ${nightsCount}
<b>Сумма:</b> ${totalPrice} ₽

<b>Гость:</b> ${guestName}
<b>Телефон:</b> ${guestPhone}
<b>Telegram:</b> ${guestTelegram ? '@' + guestTelegram.replace('@', '') : 'не указан'}
  `.trim();

  const adminUrl = new URL('/admin/bookings.html', config.baseUrl).toString();
  const isLocalAdminUrl = /(^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$))/i.test(adminUrl);
  const messagePayload = {
    chat_id: config.telegramChatId,
    text: isLocalAdminUrl ? text + '\n\nАдминка локально: ' + adminUrl : text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  if (!isLocalAdminUrl) {
    messagePayload.reply_markup = {
      inline_keyboard: [[
        { text: 'Открыть в админке', url: adminUrl }
      ]]
    };
  }

  try {
    const relayEndpoint = getRelayEndpoint();
    if (relayEndpoint) {
      await postTelegram(relayEndpoint, {
        'Content-Type': 'application/json',
        'X-Telegram-Relay-Secret': config.telegramRelaySecret,
      }, messagePayload);
      return true;
    }

    await postTelegram(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      { 'Content-Type': 'application/json' },
      messagePayload
    );
    return true;
  } catch (err) {
    console.error('[Telegram] Исключение при отправке:', err.message);
    return false; // Если падает, возвращаем false, не прерываем бронирование
  }
}

module.exports = {
  sendBookingNotification
};
