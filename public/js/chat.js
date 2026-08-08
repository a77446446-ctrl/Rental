/**
 * Клиентская логика чата поддержки
 */

(function() {
  'use strict';

  let chatToken = localStorage.getItem('eco_chat_token');
  let supabaseClient = null;
  let chatChannel = null;
  let bookingFocusUntil = Number(localStorage.getItem('chat_booking_focus_until') || 0);
  let chatTransitionTimer = null;
  let chatRingText = 'Связаться с нами';

  const els = {
    widget: document.getElementById('chat-widget'),
    header: document.getElementById('chat-header'),
    body: document.getElementById('chat-body'),
    toggle: document.getElementById('chat-toggle'),
    badge: document.getElementById('chat-badge'),
    toastBanner: document.getElementById('chat-toast-banner'),
    messages: document.getElementById('chat-messages'),
    form: document.getElementById('chat-form'),
    input: document.getElementById('chat-input'),
    attachBtn: document.getElementById('chat-attach-btn'),
    fileInput: document.getElementById('chat-file-input')
  };

  if (!els.widget) return;

  let unreadCount = 0;

  function updateUnreadBadge(count) {
    unreadCount = Math.max(0, count);
    if (!els.badge) return;
    if (unreadCount > 0 && els.body.style.display === 'none') {
      els.badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      els.badge.style.display = 'block';
    } else {
      els.badge.style.display = 'none';
    }
  }

  function showAdminReplyNotification() {
    // Disabled text notifications per user request.
    // We only use the red badge now.
  }

  function clearUnread() {
    updateUnreadBadge(0);
    if (els.toastBanner) {
      els.toastBanner.style.display = 'none';
    }
    localStorage.setItem('chat_last_read_time', new Date().toISOString());
  }

  /**
   * Генерация UUID v4 для анонимного чата
   */
  function uuidv4() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var bytes = new Uint8Array(1);
      window.crypto.getRandomValues(bytes);
      var r = bytes[0] & 15, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Инициализация чата
   */
  async function initChat() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openChat') === 'true') {
      bookingFocusUntil = Date.now() + 15000;
      localStorage.setItem('chat_booking_focus_until', String(bookingFocusUntil));
    }

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

    // 3. Загрузка настроек виджета чата (цвет, текст)
    try {
      var settings = await EcoApi.getSettings();
      if (settings) {
        if (settings.chatWidgetColor) {
          els.widget.setAttribute('data-chat-color', settings.chatWidgetColor);
        }
        if (settings.chatWidgetText !== undefined) {
          chatRingText = settings.chatWidgetText;
        }
      }
    } catch (e) {
      console.error('[Chat] Ошибка загрузки настроек виджета:', e);
    }

    // 4. Загрузка истории
    loadHistory();

    // 5. Навешивание событий
    syncToggleIcon(els.body.style.display !== 'none');
    els.header.addEventListener('click', toggleChat);
    if (els.toastBanner) {
      els.toastBanner.addEventListener('click', function() {
        if (els.body.style.display === 'none') {
          toggleChat();
        }
      });
    }
    els.form.addEventListener('submit', sendMessage);
    if (els.attachBtn && els.fileInput) {
      els.attachBtn.addEventListener('click', function() { els.fileInput.click(); });
      els.fileInput.addEventListener('change', sendAttachment);
    }
    // 4.5. Поддержка клавиатуры на мобильных устройствах
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        if (els.widget.classList.contains('is-open') && window.innerWidth <= 760) {
          var offset = window.innerHeight - window.visualViewport.height;
          if (offset > 0) {
            els.widget.style.setProperty('bottom', (offset + 10) + 'px', 'important');
            els.widget.style.setProperty('max-height', 'calc(' + window.visualViewport.height + 'px - 20px)', 'important');
          } else {
            els.widget.style.removeProperty('bottom');
            els.widget.style.removeProperty('max-height');
          }
        } else {
          els.widget.style.removeProperty('bottom');
          els.widget.style.removeProperty('max-height');
        }
      });
    }

    // 5. Автооткрытие по параметру из URL (после успешной заявки)
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

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (document.body.classList.contains('chat-open') && window.innerWidth <= 760) {
          els.widget.style.height = window.visualViewport.height + 'px';
          els.widget.style.top = window.visualViewport.offsetTop + 'px';
        } else {
          els.widget.style.height = '';
          els.widget.style.top = '';
        }
        scrollToBottom();
      });
      window.visualViewport.addEventListener('scroll', () => {
        if (document.body.classList.contains('chat-open') && window.innerWidth <= 760) {
          els.widget.style.top = window.visualViewport.offsetTop + 'px';
        }
      });
    }
  }

  function syncToggleIcon(isOpen) {
    if (!els.toggle) return;
    if (isOpen) {
      els.toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>';
    } else {
      var ringHtml = chatRingText
        ? '<svg class="chat-ring-label" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs><path id="chat-ring-path" d="M 12,60 A 48,48 0 1,1 108,60 A 48,48 0 1,1 12,60"></path></defs><text><textPath href="#chat-ring-path" startOffset="50%" text-anchor="middle">' + chatRingText + '</textPath></text></svg>'
        : '';
      els.toggle.innerHTML = ringHtml + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6.5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H10l-5 3v-3.5a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2Z"></path></svg>';
    }
    els.toggle.setAttribute('aria-label', isOpen ? 'Свернуть чат' : 'Открыть чат');
    els.widget.classList.toggle('is-open', isOpen);
  }

  function toggleChat() {
    clearTimeout(chatTransitionTimer);
    const isOpening = els.body.style.display === 'none';

    if (isOpening) {
      clearUnread();
      els.widget.classList.remove('is-closing');
      els.body.style.display = 'flex';
      requestAnimationFrame(function() {
        syncToggleIcon(true);
      });
    } else {
      /* Мгновенно переключаемся в состояние «кнопка» без промежуточного
         большого золотого пятна. Сначала скрываем тело чата, чтобы CSS-
         селектор :has(.chat-body[style*="none"]) активировал стили FAB,
         затем показываем кнопку с короткой анимацией появления. */
      els.body.style.display = 'none';
      syncToggleIcon(false);
      els.widget.classList.remove('is-closing');
      /* Короткая анимация появления золотой капли */
      els.widget.classList.add('fab-appear');
      chatTransitionTimer = setTimeout(function() {
        els.widget.classList.remove('fab-appear');
      }, 320);
    }
    
    document.body.classList.toggle('chat-open', isOpening);
    
    if (isOpening && window.visualViewport && window.innerWidth <= 760) {
      els.widget.style.height = window.visualViewport.height + 'px';
      els.widget.style.top = window.visualViewport.offsetTop + 'px';
    } else if (!isOpening) {
      els.widget.style.height = '';
      els.widget.style.top = '';
    }
    
    if (!isOpening) {
      localStorage.removeItem('chat_force_open');
    } else {
      scrollToPreferredPosition();
      if (window.innerWidth > 768) {
        els.input.focus();
      }
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
    let safeUrl;
    try {
      const parsedUrl = new URL(String(attachment.url || ''), window.location.origin);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
      safeUrl = parsedUrl.href;
    } catch (_error) {
      return false;
    }
    const wrap = document.createElement('div');
    wrap.className = 'chat-attachment';

    if (attachment.mediaType === 'image') {
      const imgLink = document.createElement('a');
      imgLink.href = safeUrl;
      imgLink.target = '_blank';
      imgLink.rel = 'noopener';
      const media = document.createElement('img');
      media.src = safeUrl;
      media.alt = 'Изображение';
      media.style.cursor = 'pointer';
      imgLink.appendChild(media);
      wrap.appendChild(imgLink);
      container.appendChild(wrap);
      return true;
    }

    if (attachment.mediaType === 'video') {
      const media = document.createElement('video');
      media.src = safeUrl;
      media.controls = true;
      media.playsInline = true;
      wrap.appendChild(media);
      container.appendChild(wrap);
      return true;
    }

    if (attachment.mediaType === 'audio') {
      const media = document.createElement('audio');
      media.src = safeUrl;
      media.controls = true;
      wrap.appendChild(media);
      container.appendChild(wrap);
      return true;
    }

    const link = document.createElement('a');
    link.href = safeUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = attachment.name || 'Скачать файл';
    wrap.appendChild(link);
    container.appendChild(wrap);
    return true;
  }

  function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = 'chat-message ' + (msg.sender_type === 'guest' ? 'guest' : 'admin');

    const attachment = parseAttachment(msg.message || '');
    if (!attachment || !renderAttachment(div, attachment)) {
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

  function shouldFocusBookingStart() {
    if (bookingFocusUntil > Date.now()) return true;
    if (bookingFocusUntil) {
      bookingFocusUntil = 0;
      localStorage.removeItem('chat_booking_focus_until');
    }
    return false;
  }

  function scrollToPreferredPosition() {
    if (shouldFocusBookingStart()) {
      const messages = els.messages.children;
      let lastBookingMsg = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].textContent.includes('Ваша заявка на бронирование')) {
          lastBookingMsg = messages[i];
          break;
        }
      }
      if (lastBookingMsg) {
        els.messages.scrollTop = Math.max(0, lastBookingMsg.offsetTop - 12);
        return;
      }
    }
    scrollToBottom();
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
        scrollToPreferredPosition();
        lastKnownCount = json.data.length;

        // Вычисляем непрочитанные сообщения от админа
        const lastRead = new Date(localStorage.getItem('chat_last_read_time') || 0).getTime();
        const unreadAdminMsgs = json.data.filter(m => m.sender_type === 'admin' && new Date(m.created_at || Date.now()).getTime() > lastRead);
        if (unreadAdminMsgs.length > 0 && els.body.style.display === 'none') {
          updateUnreadBadge(unreadAdminMsgs.length);
          showAdminReplyNotification();
        }
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
          filter: 'guest_id=eq.' + chatToken
        },
        (payload) => {
          const newMsg = payload.new;
          // Если сообщение от админа, показываем его (свои мы добавляем локально сразу)
          if (newMsg.sender_type === 'admin') {
            realtimeWorking = true; // Realtime работает — polling не нужен
            renderMessage(newMsg);
            scrollToPreferredPosition();
            lastKnownCount = els.messages.children.length;
            
            // Если чат закрыт, увеличиваем бейдж и показываем плашку
            if (els.body.style.display === 'none') {
              updateUnreadBadge(unreadCount + 1);
              showAdminReplyNotification();
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
    if (realtimeWorking || document.hidden) return;
    
    try {
      const res = await fetch('/api/chat/messages/' + chatToken);
      const json = await res.json();
      if (json.success && json.data) {
        const serverCount = json.data.length;
        if (serverCount > lastKnownCount) {
          const newAdminMsgs = json.data.slice(lastKnownCount).filter(m => m.sender_type === 'admin');
          els.messages.innerHTML = '';
          json.data.forEach(renderMessage);
          scrollToPreferredPosition();
          lastKnownCount = serverCount;
          
          // Если чат закрыт и есть новые админ-сообщения, показываем уведомления
          if (newAdminMsgs.length > 0 && els.body.style.display === 'none') {
            updateUnreadBadge(unreadCount + newAdminMsgs.length);
            showAdminReplyNotification();
          }
        }
      }
    } catch (e) {
      // Игнорируем ошибки polling
    }
  }

  setInterval(pollForNewMessages, 15000);

  /**
   * Отправка сообщения
   */
  async function sendMessage(e) {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;

    els.input.value = '';
    
    // Оптимистичный рендер
    renderMessage({ sender_type: 'guest', message: text });
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
    let isAllowed = allowed.some(function(prefix) { return file.type && file.type.startsWith(prefix); });
    if (!isAllowed && file.name) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'ogg', 'mp3', 'm4a', 'wav', 'heic', 'heif'].includes(ext)) {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      if (window.showToast) window.showToast('Можно отправить только фото, видео или аудио', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('token', chatToken);
    formData.append('file', file);

    if (els.attachBtn) els.attachBtn.disabled = true;

    // Показываем временное сообщение "Загрузка..."
    var loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message guest';
    loadingDiv.textContent = '⏳ Загрузка файла...';
    loadingDiv.style.opacity = '0.6';
    els.messages.appendChild(loadingDiv);
    scrollToBottom();

    try {
      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Ошибка загрузки');
      // Убираем временное сообщение и показываем настоящее
      if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
      renderMessage(json.data);
      scrollToBottom();
    } catch (e) {
      console.error('[Chat] Ошибка загрузки файла:', e);
      // Заменяем временное сообщение на сообщение об ошибке
      if (loadingDiv.parentNode) {
        loadingDiv.textContent = '❌ ' + (e.message || 'Ошибка загрузки файла');
        loadingDiv.style.opacity = '1';
        loadingDiv.style.color = '#ff6b6b';
      }
      if (window.showToast) window.showToast(e.message || 'Ошибка загрузки файла', 'error');
    } finally {
      if (els.attachBtn) els.attachBtn.disabled = false;
    }
  }

  // Запуск при загрузке DOM
  document.addEventListener('DOMContentLoaded', initChat);

})();
