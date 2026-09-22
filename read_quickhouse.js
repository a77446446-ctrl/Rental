const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('quickHouse.addEventListener(\'change\''));
console.log(lines.slice(idx, idx+15).join('\n'));
