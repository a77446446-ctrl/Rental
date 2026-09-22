const fs = require('fs');
const t = fs.readFileSync('src/services/telegram.service.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('Доплаты:'));
console.log(lines.slice(idx-5, idx+20).join('\n'));
