const fs = require('fs');
const path = 'public/mediakit.html';
let html = fs.readFileSync(path, 'utf8');

html = html.replace('<div class="device-label">TELEGRAM / МАКС БОТ</div>', '<div class="device-label">МАКС БОТ / TELEGRAM БОТ</div>');
// Also update the description text since it was "МАКС или Telegram" maybe
html = html.replace('Telegram или МАКС.', 'МАКС-бота или Telegram.');

fs.writeFileSync(path, html, 'utf8');
console.log('Label updated!');
