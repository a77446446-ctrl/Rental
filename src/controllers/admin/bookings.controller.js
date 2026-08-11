const { pbAdmin } = require('../../config/pocketbase');
const { normalizeBookingRecord, toPocketBaseDate } = require('../../utils/bookingRecord');

exports.getAll = async (req, res) => {
  try {
    const data = await pbAdmin.collection('bookings').getFullList({
      expand: 'cabin_id,guest_id',
      sort: '-created_at'
    });
    
    const mappedData = data.map(normalizeBookingRecord).map(b => {
      const cabin = b.expand?.cabin_id;
      const guest = b.expand?.guest_id;
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

    const data = await pbAdmin.collection('bookings').update(id, { status }, {
      expand: 'cabin_id'
    });
    
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
    res.status(500).json({ success: false, error: 'Ошибка обновления статуса' });
  }
};

exports.updateInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { check_in, check_out, total_price, comment, guest_name, guest_phone, guest_telegram, cabin_id } = req.body;
    
    // First, fetch the booking to get guest_id
    const booking = await pbAdmin.collection('bookings').getOne(id);
      
    if (booking.guest_id && (guest_name !== undefined || guest_phone !== undefined || guest_telegram !== undefined)) {
      const guestUpdate = {};
      if (guest_name !== undefined) guestUpdate.full_name = guest_name;
      if (guest_phone !== undefined) guestUpdate.phone = guest_phone;
      if (guest_telegram !== undefined) guestUpdate.telegram = guest_telegram;
      
      await pbAdmin.collection('guests').update(booking.guest_id, guestUpdate);
    }
    
    const updateData = {};
    if (check_in !== undefined) updateData.check_in_date = toPocketBaseDate(check_in);
    if (check_out !== undefined) updateData.check_out_date = toPocketBaseDate(check_out);
    if (total_price !== undefined) updateData.total_price = total_price;
    if (comment !== undefined) updateData.comment = comment;
    if (cabin_id !== undefined) updateData.cabin_id = cabin_id;

    const data = await pbAdmin.collection('bookings').update(id, updateData, {
      expand: 'cabin_id'
    });
    
    if (data.expand && data.expand.cabin_id) {
      data.cabins = { name: data.expand.cabin_id.name };
    }
    
    res.json({ success: true, data: normalizeBookingRecord(data) });
  } catch (err) {
    console.error('[bookings.controller] PATCH /bookings info error:', err);
    res.status(500).json({ success: false, error: 'Ошибка обновления бронирования' });
  }
};
