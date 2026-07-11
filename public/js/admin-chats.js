/**
 * Логика админского раздела чатов.
 */

document.addEventListener('DOMContentLoaded', () => {
  const chatList = document.getElementById('chatList');
  const chatListMeta = document.getElementById('chatListMeta');
  const threadTitle = document.getElementById('threadTitle');
  const threadMeta = document.getElementById('threadMeta');
  const messagesBox = document.getElementById('messagesBox');
  const replyForm = document.getElementById('replyForm');
  const replyInput = document.getElementById('replyInput');
  const replyBtn = document.getElementById('replyBtn');
  const attachBtn = document.getElementById('adminChatAttachBtn');
  const fileInput = document.getElementById('adminChatFileInput');

  let conversations = [];
  let selectedToken = null;

  function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function parseAttachment(message) {
    const raw = String(message || '');
    const variants = [
      raw,
      raw
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
    ];

    for (const value of variants) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && parsed.kind === 'attachment' && parsed.url) return parsed;
      } catch (e) {}
    }

    return null;
  }

  function attachmentLabel(attachment) {
    if (!attachment) return '';
    if (attachment.mediaType === 'image') return 'Фото: ' + (attachment.name || 'изображение');
    if (attachment.mediaType === 'video') return 'Видео: ' + (attachment.name || 'видео');
    if (attachment.mediaType === 'audio') return 'Аудио: ' + (attachment.name || 'аудио');
    return attachment.name || 'Вложение';
  }

  function messagePreview(message) {
    const attachment = parseAttachment(message || '');
    return attachment ? attachmentLabel(attachment) : (message || '');
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setEmpty(node, text) {
    node.innerHTML = '<div class="empty-state">' + text + '</div>';
  }

  function renderConversationList() {
    clearNode(chatList);
    chatListMeta.textContent = conversations.length
      ? conversations.length + ' диалогов'
      : 'Нет диалогов';

    if (conversations.length === 0) {
      setEmpty(chatList, 'Пока нет сообщений из виджета');
      return;
    }

    conversations.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'conversation-item' + (item.token === selectedToken ? ' active' : '');

      const title = document.createElement('div');
      title.className = 'conversation-title';

      const name = document.createElement('span');
      name.textContent = item.title;
      title.appendChild(name);

      if (item.unread_count > 0) {
        const unread = document.createElement('span');
        unread.className = 'unread-pill';
        unread.textContent = item.unread_count;
        title.appendChild(unread);
      }

      const last = document.createElement('div');
      last.className = 'conversation-last';
      last.textContent = (item.last_sender === 'admin' ? 'Вы: ' : 'Гость: ') + messagePreview(item.last_message || '');

      const date = document.createElement('div');
      date.className = 'conversation-last';
      date.textContent = formatDate(item.last_at);

      button.appendChild(title);
      button.appendChild(last);
      button.appendChild(date);
      button.addEventListener('click', () => selectConversation(item.token));

      chatList.appendChild(button);
    });
  }

  function renderMessages(messages) {
    clearNode(messagesBox);

    if (!messages || messages.length === 0) {
      setEmpty(messagesBox, 'В этом диалоге пока нет сообщений');
      return;
    }

    messages.forEach((msg) => {
      const row = document.createElement('div');
      row.className = 'message-row ' + (msg.sender_type === 'admin' ? 'admin' : 'guest');

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';

      const attachment = parseAttachment(msg.message || '');
      if (attachment) {
        const wrap = document.createElement('div');
        wrap.className = 'message-attachment';

        let media;
        if (attachment.mediaType === 'image') {
          media = document.createElement('img');
          media.src = attachment.url;
          media.alt = attachment.name || 'Изображение';
        } else if (attachment.mediaType === 'video') {
          media = document.createElement('video');
          media.src = attachment.url;
          media.controls = true;
          media.playsInline = true;
        } else if (attachment.mediaType === 'audio') {
          media = document.createElement('audio');
          media.src = attachment.url;
          media.controls = true;
        }

        if (media) wrap.appendChild(media);

        const link = document.createElement('a');
        link.href = attachment.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = attachment.name || 'Открыть файл';
        wrap.appendChild(link);
        bubble.appendChild(wrap);
      } else {
        const text = document.createElement('div');
        text.textContent = msg.message || '';
        bubble.appendChild(text);
      }

      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.textContent = (msg.sender_type === 'admin' ? 'Администратор' : 'Гость') + ' · ' + formatDate(msg.created_at);

      bubble.appendChild(meta);
      row.appendChild(bubble);
      messagesBox.appendChild(row);
    });

    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  async function loadConversations() {
    try {
      const res = await fetch('/api/admin/chats');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      conversations = json.data || [];
      renderConversationList();

      if (!selectedToken && conversations.length > 0) {
        await selectConversation(conversations[0].token);
      }
    } catch (err) {
      console.error(err);
      setEmpty(chatList, 'Ошибка загрузки чатов');
      if (window.showToast) window.showToast('Ошибка загрузки чатов', 'error');
    }
  }

  async function selectConversation(token) {
    selectedToken = token;
    const current = conversations.find((item) => item.token === token);

    threadTitle.textContent = current ? current.title : 'Диалог';
    threadMeta.textContent = current
      ? 'Последнее сообщение: ' + formatDate(current.last_at)
      : 'История сообщений';
    replyInput.disabled = false;
    replyBtn.disabled = false;
    if (attachBtn) attachBtn.disabled = false;

    renderConversationList();
    setEmpty(messagesBox, 'Загрузка сообщений...');

    try {
      const res = await fetch('/api/admin/chats/' + encodeURIComponent(token) + '/messages');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      renderMessages(json.data || []);
      await loadConversations();
    } catch (err) {
      console.error(err);
      setEmpty(messagesBox, 'Ошибка загрузки сообщений');
      if (window.showToast) window.showToast('Ошибка загрузки сообщений', 'error');
    }
  }


  async function sendAttachment(file) {
    if (!selectedToken || !file) return;

    const allowed = ['image/', 'video/', 'audio/'];
    if (!allowed.some((prefix) => file.type && file.type.startsWith(prefix))) {
      if (window.showToast) window.showToast('Можно отправить только фото, видео или аудио', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    if (attachBtn) attachBtn.disabled = true;

    try {
      const res = await fetch('/api/admin/chats/' + encodeURIComponent(selectedToken) + '/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Ошибка загрузки');
      await selectConversation(selectedToken);
      if (window.showToast) window.showToast('Файл отправлен', 'success');
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast(err.message || 'Ошибка загрузки файла', 'error');
    } finally {
      if (attachBtn) attachBtn.disabled = false;
    }
  }

  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedToken) return;

    const text = replyInput.value.trim();
    if (!text) return;

    replyBtn.disabled = true;
    replyBtn.textContent = 'Отправка...';

    try {
      const res = await fetch('/api/admin/chats/' + encodeURIComponent(selectedToken) + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      replyInput.value = '';
      await selectConversation(selectedToken);
      if (window.showToast) window.showToast('Сообщение отправлено', 'success');
    } catch (err) {
      console.error(err);
      if (window.showToast) window.showToast('Ошибка отправки сообщения', 'error');
    } finally {
      replyBtn.disabled = false;
      replyBtn.textContent = 'Отправить';
    }
  });


  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      await sendAttachment(file);
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (!confirm('Выйти из панели управления?')) return;
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin/login';
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }

  loadConversations();

  // Автообновление: опрос новых сообщений каждые 5 секунд
  let pollingActive = true;
  let lastKnownMessageCount = 0;

  async function pollForUpdates() {
    if (!pollingActive) return;
    try {
      const res = await fetch('/api/admin/chats');
      const json = await res.json();
      if (!json.success) return;

      const newConversations = json.data || [];

      // Считаем общее количество сообщений для определения изменений
      const totalMessages = newConversations.reduce((sum, c) => sum + c.total_messages, 0);
      const totalUnread = newConversations.reduce((sum, c) => sum + c.unread_count, 0);

      // Если есть изменения — обновляем список чатов
      if (totalMessages !== lastKnownMessageCount || JSON.stringify(newConversations.map(c => c.unread_count)) !== JSON.stringify(conversations.map(c => c.unread_count))) {
        conversations = newConversations;
        renderConversationList();

        // Если открыт конкретный диалог и в нём появились новые сообщения — обновляем его
        if (selectedToken) {
          const currentConv = newConversations.find(c => c.token === selectedToken);
          const oldConv = conversations.find(c => c.token === selectedToken);
          // Перезагружаем сообщения текущего диалога
          const msgRes = await fetch('/api/admin/chats/' + encodeURIComponent(selectedToken) + '/messages');
          const msgJson = await msgRes.json();
          if (msgJson.success) {
            renderMessages(msgJson.data || []);
          }
        }

        // Звуковое/визуальное уведомление о новых сообщениях
        if (totalUnread > 0 && document.hidden) {
          document.title = '(' + totalUnread + ') Чаты | EcoGorniy Admin';
        }
      }

      lastKnownMessageCount = totalMessages;
    } catch (err) {
      // Игнорируем ошибки при polling
    }
  }

  setInterval(pollForUpdates, 5000);

  // Восстанавливаем заголовок при возвращении на вкладку
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      document.title = 'Чаты | EcoGorniy Admin';
    }
  });
});
