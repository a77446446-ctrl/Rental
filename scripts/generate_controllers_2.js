const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../src/controllers/admin');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function addOneDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

const files = {
  'prices.controller.js': `const { supabaseAdmin } = require('../../config/supabase');
const externalCalendarService = require('../../services/externalCalendar.service');

function addOneDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

exports.getByCabin = async (req, res) => {
  try {
    const { cabin_id } = req.params;
    const from = req.query.from || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const to = req.query.to || futureDate.toISOString().slice(0, 10);

    const { data, error } = await supabaseAdmin
      .from('prices')
      .select('*')
      .eq('cabin_id', cabin_id);

    if (error) throw error;

    const externalBookings = await externalCalendarService.getExternalBookingsForRange(cabin_id, from, addOneDay(to));
    const external_dates = [];
    (externalBookings || []).forEach((booking) => {
      const current = new Date(booking.check_in + 'T00:00:00');
      const end = new Date(booking.check_out + 'T00:00:00');
      while (current < end) {
        external_dates.push({
          date: current.toISOString().slice(0, 10),
          source_name: booking.source_name || 'Внешний календарь',
          summary: booking.summary || null,
        });
        current.setDate(current.getDate() + 1);
      }
    });

    res.json({ success: true, data, external_dates });
  } catch (err) {
    console.error('[prices.controller] GET /prices error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки цен' });
  }
};

exports.bulkUpsert = async (req, res) => {
  try {
    const { cabin_id, dates, custom_price, is_promo, remove, is_closed } = req.body;
    
    if (!cabin_id || !dates || !dates.length) {
      return res.status(400).json({ success: false, error: 'Не переданы даты или домик' });
    }

    if (remove) {
      const { error } = await supabaseAdmin
        .from('prices')
        .delete()
        .eq('cabin_id', cabin_id)
        .in('date', dates);
      
      if (error) throw error;
      return res.json({ success: true });
    }

    if (!is_closed && custom_price == null) {
       return res.status(400).json({ success: false, error: 'Особая цена обязательна' });
    }

    const rows = dates.map(date => ({
      cabin_id,
      date,
      custom_price: custom_price ? parseInt(custom_price) : 0,
      is_promo: Boolean(is_promo),
      promo_description: is_closed ? 'CLOSED' : null
    }));

    const { error } = await supabaseAdmin
      .from('prices')
      .upsert(rows, { onConflict: 'cabin_id, date' });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('[prices.controller] POST /prices/bulk-upsert error:', err);
    res.status(500).json({ success: false, error: 'Ошибка сохранения цен' });
  }
};
`,
  'bookings.controller.js': `const { supabaseAdmin } = require('../../config/supabase');

exports.getAll = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(\`
        *,
        cabins ( name ),
        guests ( full_name, phone, telegram )
      \`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const mappedData = data.map(b => ({
      ...b,
      guest_name: b.guests?.full_name || 'Неизвестно',
      guest_phone: b.guests?.phone || '',
      guest_telegram: b.guests?.telegram || ''
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
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('[bookings.controller] PATCH /bookings status error:', err);
    res.status(500).json({ success: false, error: 'Ошибка обновления статуса' });
  }
};
`,
  'chats.controller.js': `const { supabaseAdmin } = require('../../config/supabase');
const chatService = require('../../services/chat.service');
const storageService = require('../../services/storage.service');

exports.getAll = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('chat_logs')
      .select('id, chat_token, sender_type, message, is_read, created_at')
      .not('chat_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const conversationsMap = {};
    (data || []).forEach((msg) => {
      const token = msg.chat_token;
      if (!token) return;

      if (!conversationsMap[token]) {
        conversationsMap[token] = {
          token,
          title: 'Гость #' + token.slice(0, 8).toUpperCase(),
          last_message: msg.message || '',
          last_sender: msg.sender_type,
          last_at: msg.created_at,
          total_messages: 0,
          unread_count: 0,
        };
      }

      conversationsMap[token].total_messages += 1;
      if (msg.sender_type === 'guest' && msg.is_read === false) {
        conversationsMap[token].unread_count += 1;
      }
    });

    res.json({
      success: true,
      data: Object.values(conversationsMap).sort((a, b) => new Date(b.last_at) - new Date(a.last_at)),
    });
  } catch (err) {
    console.error('[chats.controller] GET /chats error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки чатов' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { token } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return res.status(400).json({ success: false, error: 'Неверный формат токена' });
    }

    const messages = await chatService.getChatHistory(token);

    await supabaseAdmin
      .from('chat_logs')
      .update({ is_read: true })
      .eq('chat_token', token)
      .eq('sender_type', 'guest')
      .eq('is_read', false);

    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('[chats.controller] GET /chats messages error:', err);
    res.status(500).json({ success: false, error: 'Ошибка загрузки сообщений' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { token } = req.params;
    const { message } = req.body;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(token)) {
      return res.status(400).json({ success: false, error: 'Неверный формат токена' });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'Введите текст сообщения' });
    }

    const saved = await chatService.saveMessage(token, String(message).slice(0, 2000), 'admin');
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error('[chats.controller] POST /chats messages error:', err);
    res.status(500).json({ success: false, error: 'Ошибка отправки сообщения' });
  }
};

exports.uploadMedia = async (req, res) => {
  try {
    const { token } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(token)) {
      return res.status(400).json({ success: false, error: 'Неверный формат токена' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не передан' });
    }

    const url = await storageService.uploadChatAttachment(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const mediaType = req.file.mimetype.startsWith('image/')
      ? 'image'
      : req.file.mimetype.startsWith('video/')
        ? 'video'
        : 'audio';

    const payload = JSON.stringify({
      kind: 'attachment',
      mediaType,
      url,
      name: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    const saved = await chatService.saveMessage(token, payload, 'admin');
    res.json({ success: true, data: saved });
  } catch (err) {
    console.error('[chats.controller] POST /chats upload error:', err);
    res.status(500).json({ success: false, error: err.message || 'Ошибка загрузки файла' });
  }
};
`
};

for (const [filename, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, filename), content);
}
console.log('Created second batch of controllers.');
