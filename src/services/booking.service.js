const { pbAdmin } = require('../config/pocketbase');
const { normalizeBookingRecord } = require('../utils/bookingRecord');
const { sendBookingNotification } = require('./telegram.service');
const maxService = require('./max.service');
const externalCalendarService = require('./externalCalendar.service');
const { calculateBookingTotal } = require('./bookingPricing.service');
const { cleanText, validateStay } = require('../utils/validation');

async function createBooking(input) {
  validateStay(input.check_in, input.check_out);
  const data = {
    ...input,
    guest_name: cleanText(input.guest_name, { field: 'Имя', required: true, max: 255 }),
    guest_phone: cleanText(input.guest_phone, { field: 'Телефон', required: true, max: 30 }),
    guest_telegram: cleanText(input.guest_telegram, { field: 'Telegram / МАКС', max: 100 }),
    comment: cleanText(input.comment, { field: 'Комментарий', max: 4000 }),
  };

  const pricing = await calculateBookingTotal({
    cabinId: data.cabin_id,
    checkIn: data.check_in,
    checkOut: data.check_out,
    guestsCount: data.guests_count,
    extraIds: data.extras,
  });

  await externalCalendarService.assertNoExternalOverlap(data.cabin_id, data.check_in, data.check_out);

  const internalOverlap = await pbAdmin.collection('bookings').getList(1, 1, {
    filter: `cabin_id="${data.cabin_id}" && (status="pending" || status="confirmed") && check_in_date < "${data.check_out} 00:00:00.000Z" && check_out_date > "${data.check_in} 00:00:00.000Z"`,
    fields: 'id',
  });
  if (internalOverlap.totalItems > 0) {
    throw new Error('Выбранные даты уже заняты');
  }

  // 1. Управление гостем
  let guestId;
  try {
    let guest;
    try {
      guest = await pbAdmin.collection('guests').getFirstListItem(`phone="${data.guest_phone}"`);
      // Обновляем данные существующего гостя
      guest = await pbAdmin.collection('guests').update(guest.id, {
        full_name: data.guest_name,
        telegram: data.guest_telegram || null,
      });
      guestId = guest.id;
    } catch (findError) {
      if (findError.status === 404) {
        // Создаем нового гостя
        guest = await pbAdmin.collection('guests').create({
          full_name: data.guest_name,
          phone: data.guest_phone,
          telegram: data.guest_telegram || null,
        });
        guestId = guest.id;
      } else {
        throw findError;
      }
    }
  } catch (err) {
    throw new Error('Не удалось обработать данные гостя');
  }

  // 2. Создание бронирования
  const bookingData = {
    cabin_id: data.cabin_id,
    guest_id: guestId,
    check_in_date: data.check_in + " 00:00:00.000Z",
    check_out_date: data.check_out + " 00:00:00.000Z",
    guests_count: pricing.guestsCount,
    comment: data.comment || null,
    total_price: pricing.totalPrice,
    status: 'pending',
  };

  let booking;
  try {
    booking = await pbAdmin.collection('bookings').create(bookingData);
  } catch (err) {
    throw new Error(err.message || 'Не удалось создать бронирование');
  }

  const tokenMatch = data.comment ? data.comment.match(/<!--CHAT_TOKEN:([a-f0-9-]+)-->/i) : null;
  const chatToken = input.chat_token || (tokenMatch ? tokenMatch[1] : null);

  const notificationData = {
    id: booking.id,
    cabinName: pricing.cabin.name,
    checkIn: data.check_in,
    checkOut: data.check_out,
    nightsCount: pricing.nights,
    totalPrice: pricing.totalPrice,
    guestName: data.guest_name,
    guestPhone: data.guest_phone,
    guestTelegram: data.guest_telegram,
    comment: data.comment ? data.comment.replace(/<!--CHAT_TOKEN:.*?-->/gi, '').trim() : '',
    chatToken: chatToken,
  };


  let maxDelivered = false;
  try {
    // MAX — основной административный канал уведомлений.
    maxDelivered = await maxService.sendBookingNotification(notificationData);
  } catch (err) {
    console.error('[booking.service] Ошибка подготовки МАКС:', err.message);
  }

  try {
    sendBookingNotification(notificationData).catch((err) => console.error('[booking.service] Ошибка Telegram:', err.message));
  } catch (err) {
    console.error('[booking.service] Ошибка подготовки Telegram:', err.message);
  }

  return {
    ...normalizeBookingRecord(booking),
    pricing,
    notifications: { max: maxDelivered },
  };
}

module.exports = { createBooking };
