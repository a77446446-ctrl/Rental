const { config } = require('../config/env');

/**
 * Отправляет уведомление о новом бронировании в Telegram
 * @param {Object} bookingData - данные о брони
 * @returns {Promise<boolean>} true, если отправлено успешно
 */
async function sendBookingNotification(bookingData) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn('[Telegram] Токен или Chat ID не заданы. Уведомление пропущено.');
    return false;
  }

  const {
    id,
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
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    if (!response.ok) {
      console.error('[Telegram] Ошибка отправки:', await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Telegram] Исключение при отправке:', err.message);
    return false; // Если падает, возвращаем false, не прерываем бронирование
  }
}

module.exports = {
  sendBookingNotification
};
