/**
 * Клиентская логика чата поддержки
 */

(function() {
  'use strict';

  let chatToken = localStorage.getItem('eco_chat_token');
  let supabaseClient = null;
  let chatChannel = null;
  let scrollTimer = null;
  let chatState = 'closed';
  let viewportFrame = null;
  let lastViewportHeight = 0;
  let lastViewportTop = 0;
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
    if (unreadCount > 0 && isChatOpen() === false) {
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
    // 1. Инициализация токена
    if (!chatToken) {
      chatToken = uuidv4();
      localStorage.setItem('eco_chat_token', chatToken);
    }
    // Messages are delivered by the authenticated application API polling.

    // 3. Загрузка настроек виджета чата (цвет, текст)
    try {
      var settings = await EcoApi.getSettings();
      if (settings) {
        if (settings.chatWidgetColor) {
          els.widget.setAttribute('data-chat-color', settings.chatWidgetColor);
        }
        if (settings.chatWidgetText !== undefined) {
          chatRingText = String(settings.chatWidgetText || '').trim().slice(0, 48) || 'Связаться с нами';
        }
      }
    } catch (e) {
      console.error('[Chat] Widget settings load failed:', e);
    }

    // 4. Загрузка истории
    loadHistory();

    // 5. Навешивание событий
    setChatOpen(false);
    els.header.addEventListener('click', toggleChat);
    if (els.toastBanner) {
      els.toastBanner.addEventListener('click', function() {
        if (isChatOpen() === false) {
          setChatOpen(true);
        }
      });
    }
    els.form.addEventListener('submit', sendMessage);
    if (els.attachBtn && els.fileInput) {
      els.attachBtn.addEventListener('click', function() { els.fileInput.click(); });
      els.fileInput.addEventListener('change', sendAttachment);
    }
    // 5. Автооткрытие по параметру из URL (после успешной заявки)
    if (params.get('openChat') === 'true') {
      localStorage.setItem('chat_force_open', 'true');
      setTimeout(() => {
        if (isChatOpen() === false) {
          setChatOpen(true);
        }
        const url = new URL(window.location);
        url.searchParams.delete('openChat');
        window.history.replaceState({}, '', url);
      }, 300);
    } else if (localStorage.getItem('chat_force_open') === 'true') {
      setTimeout(() => {
        if (isChatOpen() === false) {
          setChatOpen(true);
        }
      }, 300);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleViewportSync, { passive: true });
      window.visualViewport.addEventListener('scroll', scheduleViewportSync, { passive: true });
    }
    window.addEventListener('resize', scheduleViewportSync, { passive: true });
  }

  function escapeRingText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function syncToggleIcon(isOpen) {
    if (!els.toggle) return;
    if (isOpen) {
      els.toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>';
    } else {
      var safeRingText = escapeRingText(chatRingText);
      var ringHtml = safeRingText
        ? '<svg class="chat-ring-label" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs><path id="chat-ring-path" d="M 6,60 A 54,54 0 1,1 114,60 A 54,54 0 1,1 6,60"></path></defs><text><textPath href="#chat-ring-path" startOffset="50%" text-anchor="middle">' + safeRingText + '</textPath></text></svg>'
        : '';
      els.toggle.innerHTML = ringHtml + '<span class="chat-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 6.5h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H10l-5 3v-3.5a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2Z"></path></svg></span>';
    }
    els.toggle.setAttribute('aria-label', isOpen ? 'Свернуть чат' : 'Открыть чат');
  }

  function isChatOpen() {
    return chatState === 'open';
  }

  function applyViewportSync() {
    viewportFrame = null;
    var viewport = window.visualViewport;
    if (isChatOpen() === false || window.innerWidth > 760 || viewport == null) {
      lastViewportHeight = 0;
      lastViewportTop = 0;
      els.widget.style.removeProperty('--chat-viewport-height');
      els.widget.style.removeProperty('--chat-viewport-top');
      return;
    }

    var nextHeight = Math.round(viewport.height);
    var nextTop = Math.round(viewport.offsetTop);
    if (nextHeight !== lastViewportHeight) {
      lastViewportHeight = nextHeight;
      els.widget.style.setProperty('--chat-viewport-height', nextHeight + 'px');
    }
    if (nextTop !== lastViewportTop) {
      lastViewportTop = nextTop;
      els.widget.style.setProperty('--chat-viewport-top', nextTop + 'px');
    }
  }

  function scheduleViewportSync() {
    if (viewportFrame !== null) return;
    viewportFrame = window.requestAnimationFrame(applyViewportSync);
  }

  function setChatOpen(open) {
    var nextState = open ? 'open' : 'closed';
    if (chatState === nextState && els.widget.dataset.state === nextState) return;
    chatState = nextState;

    els.body.hidden = open === false;
    els.body.setAttribute('aria-hidden', open ? 'false' : 'true');
    els.widget.dataset.state = nextState;
    els.widget.classList.toggle('is-open', open);
    els.widget.classList.toggle('is-collapsed', open === false);
    els.widget.classList.remove('is-closing', 'fab-appear');
    document.body.classList.toggle('chat-open', open);
    syncToggleIcon(open);

    if (open) {
      clearUnread();
      scheduleViewportSync();
      scrollToBottom();
      if (window.innerWidth > 768) els.input.focus();
    } else {
      localStorage.removeItem('chat_force_open');
      applyViewportSync();
    }
  }

  function toggleChat() {
    setChatOpen(isChatOpen() === false);
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
      media.addEventListener('load', scrollToBottom, { once: true });
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
      media.addEventListener('loadedmetadata', scrollToBottom, { once: true });
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
    if (!els.messages) return;

    const applyScroll = function() {
      els.messages.scrollTop = els.messages.scrollHeight;
    };

    applyScroll();
    window.requestAnimationFrame(function() {
      applyScroll();
      window.requestAnimationFrame(applyScroll);
    });

    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(applyScroll, 160);
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

        // Вычисляем непрочитанные сообщения от админа
        const lastRead = new Date(localStorage.getItem('chat_last_read_time') || 0).getTime();
        const unreadAdminMsgs = json.data.filter(m => m.sender_type === 'admin' && new Date(m.created_at || Date.now()).getTime() > lastRead);
        if (unreadAdminMsgs.length > 0 && isChatOpen() === false) {
          updateUnreadBadge(unreadAdminMsgs.length);
          showAdminReplyNotification();
        }
      }
    } catch (e) {
      console.error('[Чат] Не удалось загрузить историю:', e);
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
            scrollToBottom();
            lastKnownCount = els.messages.children.length;
            
            // Если чат закрыт, увеличиваем бейдж и показываем плашку
            if (isChatOpen() === false) {
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
          scrollToBottom();
          lastKnownCount = serverCount;
          
          // Если чат закрыт и есть новые админ-сообщения, показываем уведомления
          if (newAdminMsgs.length > 0 && isChatOpen() === false) {
            updateUnreadBadge(unreadCount + newAdminMsgs.length);
            showAdminReplyNotification();
          }
        }
      }
    } catch (_error) {
      // Ошибка временная: следующий запрос будет выполнен по расписанию.
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
