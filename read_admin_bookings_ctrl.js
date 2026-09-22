const fs = require('fs');
const t = fs.readFileSync('src/controllers/admin/bookings.controller.js', 'utf8');
console.log(t);
