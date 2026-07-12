/**
 * Клиентская логика чата поддержки
 */

(function() {
  'use strict';

  let chatToken = localStorage.getItem('eco_chat_token');
  let supabaseClient = null;
  let chatChannel = null;

  const els = {
    widget: document.getElementById('chat-widget'),
    header: document.getElementById('chat-header'),
    body: document.getElementById('chat-body'),
    toggle: document.getElementById('chat-toggle'),
    messages: document.getElementById('chat-messages'),
    form: document.getElementById('chat-form'),
    input: document.getElementById('chat-input'),
    attachBtn: document.getElementById('chat-attach-btn'),
    fileInput: document.getElementById('chat-file-input')
  };

  if (!els.widget) return;

  /**
   * Генерация UUID v4 для анонимного чата
   */
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Инициализация чата
   */
  async function initChat() {
    // 1. Инициализация токена
    if (!chatToken) {
      chatToken = uuidv4();
      localStorage.setItem('eco_chat_token', chatToken);
    }

    // 2. Получение конфига Supabase
    try {
      const res = await fetch('/api/chat/config');
      const json = await res.json();
      
      if (json.success && json.data.supabaseUrl) {
        // Инициализируем клиента Supabase (скрипт загружен с CDN)
        supabaseClient = window.supabase.createClient(
          json.data.supabaseUrl, 
          json.data.supabaseAnonKey
        );
        
        setupRealtime();
      }
    } catch (e) {
      console.error('[Chat] Ошибка загрузки конфига:', e);
    }

    // 3. Загрузка истории
    loadHistory();

    // 4. Навешивание событий
    syncToggleIcon(els.body.style.display !== 'none');
    els.header.addEventListener('click', toggleChat);
    els.form.addEventListener('submit', sendMessage);
    if (els.attachBtn && els.fileInput) {
      els.attachBtn.addEventListener('click', function() { els.fileInput.click(); });
      els.fileInput.addEventListener('change', sendAttachment);
    }

    // 5. Автооткрытие по параметру из URL (после успешной заявки)
    const params = new URLSearchParams(window.location.search);
    if (params.get('openChat') === 'true') {
      localStorage.setItem('chat_force_open', 'true');
      setTimeout(() => {
        if (els.body.style.display === 'none') {
          toggleChat();
        }
        const url = new URL(window.location);
        url.searchParams.delete('openChat');
        window.history.replaceState({}, '', url);
      }, 300);
    } else if (localStorage.getItem('chat_force_open') === 'true') {
      setTimeout(() => {
        if (els.body.style.display === 'none') {
          toggleChat();
        }
      }, 300);
    }
  }

  function syncToggleIcon(isOpen) {
    if (!els.toggle) return;
    if (isOpen) {
      els.toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>';
    } else {
      els.toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6.5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H10l-5 3v-3.5a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2Z"></path></svg>';
    }
    els.toggle.setAttribute('aria-label', isOpen ? 'Свернуть чат' : 'Открыть чат');
    els.widget.classList.toggle('is-open', isOpen);
  }

  function toggleChat() {
    const isOpening = els.body.style.display === 'none';
    els.body.style.display = isOpening ? 'flex' : 'none';
    syncToggleIcon(isOpening);
    
    document.body.classList.toggle('chat-open', isOpening);
    
    if (!isOpening) {
      localStorage.removeItem('chat_force_open');
    } else {
      scrollToBottom();
      els.input.focus();
    }
  }

  /**
   * Рендер одного сообщения
   */
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

  function renderAttachment(container, attachment) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-attachment';

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
    container.appendChild(wrap);
  }

  function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = 'chat-message ' + (msg.sender_type === 'guest' ? 'guest' : 'admin');

    const attachment = parseAttachment(msg.message || '');
    if (attachment) {
      renderAttachment(div, attachment);
    } else {
      const text = msg.message || '';
      if (text.includes('---')) {
        const parts = text.split('---');
        div.innerHTML = '';
        parts.forEach((part, index) => {
          const span = document.createElement('span');
          span.textContent = part;
          div.appendChild(span);
          if (index < parts.length - 1) {
            const hr = document.createElement('hr');
            hr.className = 'chat-divider';
            div.appendChild(hr);
          }
        });
      } else {
        div.textContent = text;
      }
    }

    els.messages.appendChild(div);
  }

  function scrollToBottom() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  /**
   * Загрузка истории из API
   */
  async function loadHistory() {
    try {
      const res = await fetch('/api/chat/messages/' + chatToken);
      const json = await res.json();
      if (json.success && json.data) {
        els.messages.innerHTML = '';
        json.data.forEach(renderMessage);
        scrollToBottom();
        lastKnownCount = json.data.length;
      }
    } catch (e) {
      console.error('[Chat] Ошибка загрузки истории:', e);
    }
  }

  /**
   * Подписка на Supabase Realtime
   */
  function setupRealtime() {
    if (!supabaseClient) return;

    chatChannel = supabaseClient.channel('public:chat_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_logs',
          filter: 'chat_token=eq.' + chatToken
        },
        (payload) => {
          const newMsg = payload.new;
          // Если сообщение от админа, показываем его (свои мы добавляем локально сразу)
          if (newMsg.sender_type === 'admin') {
            realtimeWorking = true; // Realtime работает — polling не нужен
            renderMessage(newMsg);
            scrollToBottom();
            lastKnownCount = els.messages.children.length;
            
            // Если чат закрыт, показываем уведомление
            if (els.body.style.display === 'none' && window.showToast) {
              window.showToast('Новое сообщение от поддержки!', 'success');
            }
          }
        }
      )
      .subscribe();
  }

  /**
   * Polling-фоллбэк: если Realtime не работает, опрашиваем сервер каждые 5 секунд
   */
  let lastKnownCount = 0;
  let realtimeWorking = false;

  async function pollForNewMessages() {
    // Если Realtime уже доказал свою работоспособность — не тратим трафик на polling
    if (realtimeWorking) return;
    
    try {
      const res = await fetch('/api/chat/messages/' + chatToken);
      const json = await res.json();
      if (json.success && json.data) {
        const serverCount = json.data.length;
        if (serverCount > lastKnownCount) {
          // Есть новые сообщения — перерисовываем
          els.messages.innerHTML = '';
          json.data.forEach(renderMessage);
          scrollToBottom();
          lastKnownCount = serverCount;
          
          // Если чат закрыт, показываем уведомление
          if (els.body.style.display === 'none' && window.showToast) {
            window.showToast('Новое сообщение от поддержки!', 'success');
          }
        }
      }
    } catch (e) {
      // Игнорируем ошибки polling
    }
  }

  setInterval(pollForNewMessages, 5000);

  /**
   * Отправка сообщения
   */
  async function sendMessage(e) {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;

    els.input.value = '';
    
    // Оптимистичный рендер
    renderMessage({ sender_type: 'guest', message: text.replace(/</g, "&lt;").replace(/>/g, "&gt;") });
    scrollToBottom();

    try {
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: chatToken,
          message: text
        })
      });
    } catch (e) {
      console.error('[Chat] Ошибка отправки:', e);
      if (window.showToast) window.showToast('Ошибка при отправке сообщения', 'error');
    }
  }


  async function sendAttachment() {
    if (!els.fileInput || !els.fileInput.files || els.fileInput.files.length === 0) return;

    const file = els.fileInput.files[0];
    els.fileInput.value = '';

    const allowed = ['image/', 'video/', 'audio/'];
    if (!allowed.some(function(prefix) { return file.type && file.type.startsWith(prefix); })) {
      if (window.showToast) window.showToast('Можно отправить только фото, видео или аудио', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('token', chatToken);
    formData.append('file', file);

    if (els.attachBtn) els.attachBtn.disabled = true;

    try {
      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Ошибка загрузки');
      renderMessage(json.data);
      scrollToBottom();
    } catch (e) {
      console.error('[Chat] Ошибка загрузки файла:', e);
      if (window.showToast) window.showToast(e.message || 'Ошибка загрузки файла', 'error');
    } finally {
      if (els.attachBtn) els.attachBtn.disabled = false;
    }
  }

  // Запуск при загрузке DOM
  document.addEventListener('DOMContentLoaded', initChat);

})();
