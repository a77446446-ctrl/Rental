const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('function performQuickSearch'));
console.log(lines.slice(idx+90, idx+110).join('\n'));
