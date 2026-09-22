const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const idx = t.indexOf("sessionStorage.setItem('lastBookingPayload'");
console.log(t.slice(idx-500, idx+500));
