const { supabaseAdmin } = require('../config/supabase');
const { sendBookingNotification } = require('./telegram.service');
const externalCalendarService = require('./externalCalendar.service');

/**
 * Создает новое бронирование и отправляет уведомление администратору в Telegram.
 * 
 * @param {Object} data Данные бронирования
 * @param {string} data.cabin_id UUID домика
 * @param {string} data.check_in Дата заезда (YYYY-MM-DD)
 * @param {string} data.check_out Дата выезда (YYYY-MM-DD)
 * @param {string} data.guest_name Имя гостя
 * @param {string} data.guest_phone Телефон гостя
 * @param {string} [data.guest_telegram] Телеграм (опционально)
 * @param {string} [data.comment] Комментарий
 * @param {number} data.total_price Общая сумма
 * @param {Array}  [data.extras] Дополнительные услуги [{ service_id, price_at_booking }]
 */
async function createBooking(data) {
  await externalCalendarService.assertNoExternalOverlap(
    data.cabin_id,
    data.check_in,
    data.check_out
  );

  // 1. Ищем или создаем гостя по номеру телефона
  let guestId;
  const { data: existingGuests, error: guestError } = await supabaseAdmin
    .from('guests')
    .select('id')
    .eq('phone', data.guest_phone)
    .limit(1);

  if (guestError) {
    console.error('[booking.service] Ошибка при поиске гостя:', guestError.message);
    throw new Error('Не удалось обработать данные гостя');
  }

  if (existingGuests && existingGuests.length > 0) {
    guestId = existingGuests[0].id;
    // Можно обновить данные гостя, если они изменились
    await supabaseAdmin
      .from('guests')
      .update({ full_name: data.guest_name, telegram: data.guest_telegram || null })
      .eq('id', guestId);
  } else {
    const { data: newGuest, error: createGuestError } = await supabaseAdmin
      .from('guests')
      .insert([{
        full_name: data.guest_name,
        phone: data.guest_phone,
        telegram: data.guest_telegram || null
      }])
      .select()
      .single();

    if (createGuestError) {
      console.error('[booking.service] Ошибка при создании гостя:', createGuestError.message);
      throw new Error('Не удалось создать запись гостя');
    }
    guestId = newGuest.id;
  }

  // 2. Создаем запись о брони в БД
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .insert([{
      cabin_id: data.cabin_id,
      guest_id: guestId,
      check_in: data.check_in,
      check_out: data.check_out,
      guests_count: data.guests_count || 1,
      comment: data.comment || null,
      total_price: data.total_price,
      status: 'pending' // Бронь по умолчанию 'pending'
    }])
    .select()
    .single();

  if (error) {
    console.error('[booking.service] Ошибка при создании бронирования:', error.message);
    throw new Error('Не удалось создать бронирование');
  }

  // 2. Добавляем связанные доп. услуги, если они есть
  if (data.extras && data.extras.length > 0) {
    const extrasToInsert = data.extras.map(e => ({
      booking_id: booking.id,
      service_id: e.service_id,
      price_at_booking: e.price_at_booking
    }));

    const { error: extrasError } = await supabaseAdmin
      .from('booking_extra_services')
      .insert(extrasToInsert);

    if (extrasError) {
      console.error('[booking.service] Ошибка добавления доп. услуг:', extrasError.message);
      // Мы не прерываем процесс, т.к. основная бронь уже успешно создана
    }
  }

  // 3. Подготовка данных для Telegram-уведомления
  try {
    const { data: cabin } = await supabaseAdmin
      .from('cabins')
      .select('name')
      .eq('id', data.cabin_id)
      .single();

    const checkInDate = new Date(data.check_in);
    const checkOutDate = new Date(data.check_out);
    // Считаем ночи (разница в днях)
    const nightsCount = Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    const notificationData = {
      id: booking.id,
      cabinName: cabin ? cabin.name : 'Неизвестный домик',
      checkIn: data.check_in,
      checkOut: data.check_out,
      nightsCount: nightsCount > 0 ? nightsCount : 1,
      totalPrice: data.total_price,
      guestName: data.guest_name,
      guestPhone: data.guest_phone,
      guestTelegram: data.guest_telegram
    };

    // 4. Отправляем уведомление
    // Важно: мы перехватываем ошибку .catch(), чтобы падение Telegram API
    // или отсутствие токена не отменило успешную бронь для пользователя.
    sendBookingNotification(notificationData).catch(err => {
      console.error('[booking.service] Ошибка вызова Telegram-уведомления:', err.message);
    });

  } catch (err) {
    console.error('[booking.service] Ошибка подготовки данных Telegram:', err.message);
  }

  return booking;
}

module.exports = {
  createBooking
};
