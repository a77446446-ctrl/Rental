const { supabaseAdmin } = require('../../config/supabase');

exports.getAll = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        cabins ( name ),
        guests ( full_name, phone, telegram )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const mappedData = data.map(b => ({
      ...b,
      guest_name: b.guests?.full_name || 'Неизвестно',
      guest_phone: b.guests?.phone || '',
      guest_telegram: b.guests?.telegram || '',
      comment: b.comment ? b.comment.replace(/<!--CHAT_TOKEN:.*?-->/g, '').trim() : ''
    }));

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

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select(`*, cabins ( name )`)
      .single();

    if (error) throw error;

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

    res.json({ success: true, data: { ...data, comment: data.comment ? data.comment.replace(/<!--CHAT_TOKEN:.*?-->/g, '').trim() : '' } });
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
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('guest_id')
      .eq('id', id)
      .single();
      
    if (fetchErr) throw fetchErr;
    
    if (booking.guest_id && (guest_name !== undefined || guest_phone !== undefined || guest_telegram !== undefined)) {
      await supabaseAdmin
        .from('guests')
        .update({ 
          full_name: guest_name, 
          phone: guest_phone, 
          telegram: guest_telegram 
        })
        .eq('id', booking.guest_id);
    }
    
    const updateData = {};
    if (check_in !== undefined) updateData.check_in = check_in;
    if (check_out !== undefined) updateData.check_out = check_out;
    if (total_price !== undefined) updateData.total_price = total_price;
    if (comment !== undefined) updateData.comment = comment;
    if (cabin_id !== undefined) updateData.cabin_id = cabin_id;

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select('*, cabins(name)')
      .single();

    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('[bookings.controller] PATCH /bookings info error:', err);
    res.status(500).json({ success: false, error: 'Ошибка обновления бронирования' });
  }
};
