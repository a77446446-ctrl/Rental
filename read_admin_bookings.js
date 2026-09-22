const fs = require('fs');
const t = fs.readFileSync('src/routes/admin.routes.js', 'utf8');
const idx = t.indexOf('router.get(\'/bookings\'');
console.log(t.slice(idx, idx+1500));
