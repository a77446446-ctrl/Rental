const { supabaseAdmin } = require('../config/supabase');
const { sendBookingNotification } = require('./telegram.service');
const externalCalendarService = require('./externalCalendar.service');
const { calculateBookingTotal } = require('./bookingPricing.service');
const { cleanText, validateStay } = require('../utils/validation');

function isMissingRpc(error) {
  return error && (error.code === 'PGRST202' || String(error.message || '').includes('create_booking_atomic'));
}

async function insertLegacy(data, pricing) {
  let guestId;
  const { data: existing, error: findError } = await supabaseAdmin
    .from('guests').select('id').eq('phone', data.guest_phone).limit(1);
  if (findError) throw new Error('Не удалось обработать данные гостя');

  if (existing && existing.length) {
    guestId = existing[0].id;
    await supabaseAdmin.from('guests').update({
      full_name: data.guest_name,
      telegram: data.guest_telegram || null,
    }).eq('id', guestId);
  } else {
    const { data: guest, error } = await supabaseAdmin.from('guests').insert([{
      full_name: data.guest_name,
      phone: data.guest_phone,
      telegram: data.guest_telegram || null,
    }]).select().single();
    if (error) throw new Error('Не удалось создать запись гостя');
    guestId = guest.id;
  }

  const row = {
    cabin_id: data.cabin_id,
    guest_id: guestId,
    check_in: data.check_in,
    check_out: data.check_out,
    guests_count: pricing.guestsCount,
    comment: data.comment || null,
    total_price: pricing.totalPrice,
    status: 'pending',
    extras_snapshot: pricing.extrasSnapshot,
  };

  let result = await supabaseAdmin.from('bookings').insert([row]).select().single();
  if (result.error && String(result.error.message).includes('extras_snapshot')) {
    delete row.extras_snapshot;
    result = await supabaseAdmin.from('bookings').insert([row]).select().single();
  }
  if (result.error) throw new Error(result.error.message || 'Не удалось создать бронирование');
  return result.data;
}

async function createBooking(input) {
  validateStay(input.check_in, input.check_out);
  const data = {
    ...input,
    guest_name: cleanText(input.guest_name, { field: 'Имя', required: true, max: 255 }),
    guest_phone: cleanText(input.guest_phone, { field: 'Телефон', required: true, max: 30 }),
    guest_telegram: cleanText(input.guest_telegram, { field: 'Telegram', max: 100 }),
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

  const params = {
    p_cabin_id: data.cabin_id,
    p_check_in: data.check_in,
    p_check_out: data.check_out,
    p_guest_name: data.guest_name,
    p_guest_phone: data.guest_phone,
    p_guest_telegram: data.guest_telegram || null,
    p_comment: data.comment || null,
    p_guests_count: pricing.guestsCount,
    p_total_price: pricing.totalPrice,
    p_extras_snapshot: pricing.extrasSnapshot,
  };

  let booking;
  const rpc = await supabaseAdmin.rpc('create_booking_atomic', params);
  if (rpc.error) {
    if (!isMissingRpc(rpc.error)) throw new Error(rpc.error.message || 'Не удалось создать бронирование');
    console.warn('[booking.service] Миграция 006 не применена; используется совместимый неатомарный режим.');
    booking = await insertLegacy(data, pricing);
  } else {
    booking = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  }

  try {
    sendBookingNotification({
      id: booking.id,
      cabinName: pricing.cabin.name,
      checkIn: data.check_in,
      checkOut: data.check_out,
      nightsCount: pricing.nights,
      totalPrice: pricing.totalPrice,
      guestName: data.guest_name,
      guestPhone: data.guest_phone,
      guestTelegram: data.guest_telegram,
    }).catch((err) => console.error('[booking.service] Ошибка Telegram:', err.message));
  } catch (err) {
    console.error('[booking.service] Ошибка подготовки Telegram:', err.message);
  }

  return { ...booking, pricing };
}

module.exports = { createBooking };
