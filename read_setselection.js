const fs = require('fs');
const t = fs.readFileSync('public/js/calendar.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('EcoCalendar.prototype.setSelection'));
console.log(lines.slice(idx, idx+20).join('\n'));
