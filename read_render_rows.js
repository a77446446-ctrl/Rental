const fs = require('fs');
const t = fs.readFileSync('public/js/admin-bookings.js', 'utf8');
const idx = t.indexOf('const renderRows');
console.log(t.slice(idx, idx+3000));
