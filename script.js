const fs = require('fs');
const path = 'public/mediakit.html';
let html = fs.readFileSync(path, 'utf8');

// Replace CSS
const newCss = `
    .mockup-iphone {
      width: 320px; height: 660px; background: #000; border-radius: 50px;
      border: 12px solid #0a0a0a; position: relative;
      box-shadow: 0 0 0 2px #444, 0 0 0 4px #7a7a7a, 0 0 0 5px #222, 0 40px 80px rgba(0,0,0,0.8); flex-shrink: 0;
    }
    .mockup-iphone::before { /* Notch */
      content: ''; position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      width: 110px; height: 32px; background: #000; border-radius: 20px; z-index: 10;
      box-shadow: inset 0 0 0 1px #111, 0 0 10px rgba(0,0,0,0.5);
    }
    .mockup-iphone::after { /* Side buttons */
      content: ''; position: absolute; top: 120px; left: -14px; width: 4px; height: 35px; background: #555; border-radius: 4px 0 0 4px; box-shadow: 0 55px 0 #555, 334px 40px 0 #555; z-index: 10;
    }
    .mockup-iphone iframe, .mockup-iphone .tg-mock { border-radius: 38px; width: 100%; height: 100%; border: none; background: var(--bg); position: relative; z-index: 1; }

    .mockup-arrows { display: flex; flex-direction: column; gap: 40px; align-items: center; justify-content: center; opacity: 0.8;}
    .mockup-arrows svg { stroke: var(--gold); stroke-width: 1.5; width: 80px; height: 40px; }

    /* TG Mock */
    .tg-mock { background: #1c242d; overflow: hidden; display: flex; flex-direction: column; font-family: -apple-system, sans-serif; }
    .tg-header { background: #1c242d; padding: 15px; display: flex; align-items: center; gap: 10px; font-size: 16px; border-bottom: 1px solid #2a3541; padding-top: 45px; }
    .tg-header-back { color: #6ab2f2; font-size: 24px; line-height: 1; cursor: pointer; }
    .tg-header-avatar { width: 36px; height: 36px; background: #2b5278; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }
    .tg-header-info { flex: 1; }
    .tg-header-title { color: #fff; font-weight: 600; font-size: 15px; }
    .tg-header-status { color: #7f91a4; font-size: 12px; }
    .tg-body { padding: 15px; flex-grow: 1; background-image: url('data:image/svg+xml;utf8,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="%230f172a"/><circle cx="50" cy="50" r="40" fill="none" stroke="%231e293b" stroke-width="2"/></svg>'); background-size: 100px; display: flex; flex-direction: column; gap: 15px; position: relative; }
    .tg-date { align-self: center; background: rgba(0,0,0,0.3); color: #fff; font-size: 11px; padding: 4px 10px; border-radius: 12px; font-weight: 500; }
    .tg-msg { background: #212d3b; padding: 10px 14px 10px; border-radius: 16px; border-bottom-left-radius: 4px; max-width: 85%; align-self: flex-start; font-size: 15px; line-height: 1.4; box-shadow: 0 1px 2px rgba(0,0,0,0.2); color: #fff; position: relative; padding-bottom: 24px; }
    .tg-msg-title { display: block; color: #6ab2f2; font-size: 14px; margin-bottom: 4px; font-weight: 600;}
    .tg-msg-time { position: absolute; bottom: 6px; right: 10px; font-size: 11px; color: #7f91a4; }
    .tg-msg-footer { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); }
    .tg-input { height: 50px; background: #1c242d; border-top: 1px solid #2a3541; display: flex; align-items: center; padding: 0 15px; gap: 15px; color: #7f91a4; padding-bottom: 15px; }
    .tg-input svg { width: 24px; height: 24px; stroke: #7f91a4; stroke-width: 1.5; fill: none; }
`;

html = html.replace(/    \.mockup-iphone \{[\s\S]*?\.feature-card \{/, newCss + '\n    .feature-card {');

// Replace HTML
const newHtml = `    <div class="devices-row" style="justify-content: center; gap: 40px; align-items: center;">
      <!-- Чат на сайте -->
      <div class="device-group">
        <div class="device-label">ВЕБ-ЧАТ НА САЙТЕ</div>
        <div class="mockup-iphone">
          <iframe src="/?openChat=true"></iframe>
        </div>
      </div>

      <div class="mockup-arrows">
        <svg viewBox="0 0 40 30" fill="none">
          <path d="M5 10 L35 10 M30 5 L35 10 L30 15" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg viewBox="0 0 40 30" fill="none">
          <path d="M35 20 L5 20 M10 15 L5 20 L10 25" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Telegram -->
      <div class="device-group">
        <div class="device-label">TELEGRAM БОТ</div>
        <div class="mockup-iphone">
          <div class="tg-mock">
            <div class="tg-header">
              <div class="tg-header-back">‹</div>
              <div class="tg-header-avatar">🤖</div>
              <div class="tg-header-info">
                <div class="tg-header-title">Админ Бронирования</div>
                <div class="tg-header-status">bot</div>
              </div>
              <div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg></div>
            </div>
            <div class="tg-body">
              <div class="tg-date">Today</div>
              
              <div class="tg-msg">
                <span class="tg-msg-title">Админ Бронирования</span>
                Новое бронирование!<br>Домик №3<br><br>Домик №3<br><br>
                📅 Даты:<br>15 - 18 мая (3 ночи)<br><br>
                👤 Гости:<br>Иван Иванов,<br><a href="#" style="color:#6ab2f2;text-decoration:none;">+7 (900) 123-45-67</a><br><br>
                ✅ Оплачено
                <div class="tg-msg-time">15:33</div>
              </div>

            </div>
            <div class="tg-input">
              <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div style="flex:1; font-size: 15px;">Message</div>
              <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>`;

html = html.replace(/<div class="section">\s*<div class="sec-header" style="margin-bottom: 40px;">[\s\S]*?<div class="devices-row">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/, (match) => {
    return match.replace(/<div class="devices-row">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/, newHtml);
});

fs.writeFileSync(path, html, 'utf8');
console.log('Done!');
