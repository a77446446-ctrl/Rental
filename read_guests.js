const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('checkoutGuests') && l.includes('addEventListener'));
console.log(lines.slice(idx-2, idx+15).join('\n'));
