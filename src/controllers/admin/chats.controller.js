const { supabaseAdmin } = require('../../config/supabase');
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
