const fs = require('fs');
const path = 'public/mediakit.html';
let html = fs.readFileSync(path, 'utf8');

if (!html.includes('.features-grid {')) {
    html = html.replace('.feature-card {', '    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; width: 100%; max-width: 1200px; }\n    .feature-card {');
}

html = html.replace('<div><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><circle cx="12" cy="12" r="10"/></svg></div>', '');

html = html.replace('.tg-header-avatar { width: 36px; height: 36px;', '.tg-header-avatar { width: 44px; height: 44px; font-size: 22px;');

html = html.replace('<div class="device-label">TELEGRAM БОТ</div>', '<div class="device-label">TELEGRAM / МАКС БОТ</div>');

fs.writeFileSync(path, html, 'utf8');
console.log('Done CSS and Avatar changes!');
