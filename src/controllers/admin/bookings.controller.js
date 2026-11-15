const { pbAdmin } = require('../../config/pocketbase');
const { normalizeBookingRecord, toPocketBaseDate } = require('../../utils/bookingRecord');
const { assertBookingDatesAvailable, assertBookingProtection } = require('../../services/booking.service');
const { validateRecordId, validateStay } = require('../../utils/validation');

function bookingUpdateError(res, error, fallback) {
  const message = String(error.message || '');
  if (error.status === 503) return res.status(503).json({ success: false, error: message });
  if (/занят|закрыт/i.test(message)) return res.status(409).json({ success: false, error: message });
  if (/формат|позже|длиннее|несуществующая/i.test(message)) return res.status(400).json({ success: false, error: message });
  return res.status(error.status === 404 ? 404 : 500).json({ success: false, error: fallback });
}

async function updateBooking(id, update, stay) {
  if (stay) {
    await assertBookingProtection();
    await assertBookingDatesAvailable(stay, true);
  }
  try {
    return await pbAdmin.collection('bookings').update(id, update, { expand: 'cabin_id' });
  } catch (error) {
    if (stay && error.status === 400) await assertBookingDatesAvailable(stay, true);
    throw error;
  }
}

exports.getAll = async (req, res) => {
  try {
    const data = await pbAdmin.collection('bookings').getFullList({
      expand: 'cabin_id,guest_id',
      sort: '-created'
    });

    const [allCabins, guests] = data.length ? await Promise.all([
      pbAdmin.collection('cabins').getFullList({ fields: 'id,name' }),
      pbAdmin.collection('guests').getFullList({ fields: 'id,full_name,phone,telegram' }),
    ]) : [[], []];
    const cabinsMap = new Map(allCabins.map(cabin => [cabin.id, cabin]));
    const guestsMap = new Map(guests.map(guest => [guest.id, guest]));
    
    const mappedData = data.map(normalizeBookingRecord).map(b => {
      const cabin = b.expand?.cabin_id || cabinsMap.get(b.cabin_id);
      const guest = b.expand?.guest_id || guestsMap.get(b.guest_id);
      return {
        ...b,
        cabins: cabin ? { name: cabin.name } : null,
        guests: guest ? { full_name: guest.full_name, phone: guest.phone, telegram: guest.telegram } : null,
        guest_name: guest?.full_name || 'Неизвестно',
        guest_phone: guest?.phone || '',
        guest_telegram: guest?.telegram || '',
        comment: b.comment ? b.comment.replace(/<!--CHAT_TOKEN:.*?-->/g, '').trim() : ''
      };
    });

    res.json({ success: true, data: mappedData });
  } catch (err) {
    console.error('[bookings.controller] GET /bookings error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки бронирований' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Неверный статус' });
    }

    const booking = normalizeBookingRecord(await pbAdmin.collection('bookings').getOne(id));
    const stay = status !== 'cancelled' && status !== booking.status ? booking : null;
    const data = await updateBooking(id, { status }, stay);
    
    if (data.expand && data.expand.cabin_id) {
      data.cabins = { name: data.expand.cabin_id.name };
    }

    // Send chat notification if chat_token exists
    if (data && data.comment && data.comment.includes('<!--CHAT_TOKEN:')) {
      const match = data.comment.match(/<!--CHAT_TOKEN:(.*?)-->/);
      if (match && match[1]) {
        const chat_token = match[1];
        const chatService = require('../../services/chat.service');
        try {
          if (status === 'confirmed') {
             await chatService.saveMessage(chat_token, '✅ Ваше бронирование подтверждено! Будем рады видеть вас.', 'admin');
          } else if (status === 'cancelled') {
             await chatService.saveMessage(chat_token, '🤷‍♂️ К сожалению, мы вынуждены отклонить вашу заявку на бронирование.', 'admin');
          }
        } catch (chatErr) {
          console.error('[bookings.controller] Failed to send chat notification:', chatErr);
        }
      }
    }

    res.json({ success: true, data: { ...normalizeBookingRecord(data), comment: data.comment ? data.comment.replace(/<!--CHAT_TOKEN:.*?-->/g, '').trim() : '' } });
  } catch (err) {
    console.error('[bookings.controller] PATCH /bookings status error:', err);
    bookingUpdateError(res, err, 'Ошибка обновления статуса');
  }
};

exports.updateInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { check_in, check_out, total_price, comment, guest_name, guest_phone, guest_telegram, cabin_id } = req.body;
    
    const booking = normalizeBookingRecord(await pbAdmin.collection('bookings').getOne(id));
    const next = {
      id,
      cabin_id: cabin_id === undefined ? booking.cabin_id : validateRecordId(cabin_id, 'Объект'),
      check_in: check_in === undefined ? booking.check_in : check_in,
      check_out: check_out === undefined ? booking.check_out : check_out,
    };
    const changedStay = next.cabin_id !== booking.cabin_id || next.check_in !== booking.check_in || next.check_out !== booking.check_out;
    if (changedStay) validateStay(next.check_in, next.check_out);
    
    const updateData = {};
    if (check_in !== undefined) updateData.check_in_date = toPocketBaseDate(check_in);
    if (check_out !== undefined) updateData.check_out_date = toPocketBaseDate(check_out);
    if (total_price !== undefined) updateData.total_price = total_price;
    if (comment !== undefined) updateData.comment = comment;
    if (cabin_id !== undefined) updateData.cabin_id = cabin_id;

    const data = await updateBooking(id, updateData, changedStay && ['pending', 'confirmed'].includes(booking.status) ? next : null);

    const guestUpdate = {};
    if (guest_name !== undefined) guestUpdate.full_name = guest_name;
    if (guest_phone !== undefined) guestUpdate.phone = guest_phone;
    if (guest_telegram !== undefined) guestUpdate.telegram = guest_telegram;
    if (booking.guest_id && Object.keys(guestUpdate).length) {
      await pbAdmin.collection('guests').update(booking.guest_id, guestUpdate);
    }
    
    if (data.expand && data.expand.cabin_id) {
      data.cabins = { name: data.expand.cabin_id.name };
    }
    
    res.json({ success: true, data: normalizeBookingRecord(data) });
  } catch (err) {
    console.error('[bookings.controller] PATCH /bookings info error:', err);
    bookingUpdateError(res, err, 'Ошибка обновления бронирования');
  }
};
