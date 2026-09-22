const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const idx = t.indexOf('submitBookingBtn.addEventListener');
console.log(t.slice(idx, idx+1500));
