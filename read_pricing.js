const fs = require('fs');
const t = fs.readFileSync('src/services/bookingPricing.service.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('base_guests'));
console.log(lines.slice(idx-5, idx+25).join('\n'));
