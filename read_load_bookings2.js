const fs = require('fs');
const t = fs.readFileSync('public/js/admin-bookings.js', 'utf8');
const idx = t.indexOf('async function loadBookings');
console.log(t.slice(idx, idx+2500));
