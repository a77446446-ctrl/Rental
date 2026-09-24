const fs = require('fs');
const path = 'public/mediakit.html';
let html = fs.readFileSync(path, 'utf8');

const middlePhone = `        <!-- АДМИН-ПАНЕЛЬ -->
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

// Find the first mockup arrows and insert the middle phone AFTER it.
const searchTarget = `        <div class="mockup-arrows">
          <svg viewBox="0 0 40 30" fill="none">
            <path d="M5 10 L35 10 M30 5 L35 10 L30 15" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg viewBox="0 0 40 30" fill="none">
            <path d="M35 20 L5 20 M10 15 L5 20 L10 25" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`;

if (html.includes(searchTarget)) {
    // Only replace the FIRST occurrence (which is the one we want to add to)
    html = html.replace(searchTarget, searchTarget + '\n\n' + middlePhone);
    fs.writeFileSync(path, html, 'utf8');
    console.log('Successfully added the third phone back!');
} else {
    console.log('Could not find the target string!');
}
