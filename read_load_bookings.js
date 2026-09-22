const fs = require('fs');
const t = fs.readFileSync('public/admin/bookings.html', 'utf8');
const idx = t.indexOf('async function loadBookings');
console.log(t.slice(idx, idx+2500));
