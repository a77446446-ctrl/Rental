const fs = require('fs');
const path = 'public/mediakit.html';
let html = fs.readFileSync(path, 'utf8');

const middlePhone = `        <div class="mockup-arrows">
          <svg viewBox="0 0 40 30" fill="none">
            <path d="M5 10 L35 10 M30 5 L35 10 L30 15" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg viewBox="0 0 40 30" fill="none">
            <path d="M35 20 L5 20 M10 15 L5 20 L10 25" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- АДМИН-ПАНЕЛЬ -->
        <div class="device-group">
          <div class="device-label">АДМИН-ПАНЕЛЬ</div>
          <div class="mockup-iphone">
            <iframe src="/admin/chats.html"></iframe>
          </div>
        </div>

        <div class="mockup-arrows">
          <svg viewBox="0 0 40 30" fill="none">
            <path d="M5 10 L35 10 M30 5 L35 10 L30 15" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg viewBox="0 0 40 30" fill="none">
            <path d="M35 20 L5 20 M10 15 L5 20 L10 25" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`;

// Replace <div class="mockup-arrows">...</div> with middlePhone
html = html.replace(/<div class="mockup-arrows">[\s\S]*?<\/div>/, middlePhone);

fs.writeFileSync(path, html, 'utf8');
console.log('Replaced successfully!');
