const fs = require('fs');
const t = fs.readFileSync('src/services/max.service.js', 'utf8');
const idx = t.indexOf('async function handleMaxWebhook');
console.log(t.slice(idx, idx+2500));
