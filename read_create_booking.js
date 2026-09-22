const fs = require('fs');
const t = fs.readFileSync('src/services/booking.service.js', 'utf8');
const idx = t.indexOf("pbAdmin.collection('bookings').create");
console.log(t.slice(idx-200, idx+500));
