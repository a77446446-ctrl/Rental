const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('function performQuickSearch'));
console.log(lines.slice(idx+45, idx+90).join('\n'));
