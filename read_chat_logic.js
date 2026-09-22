const fs = require('fs');
const t = fs.readFileSync('src/routes/public.routes.js', 'utf8');
const idx = t.indexOf('if (chat_token)');
console.log(t.slice(idx, idx+1500));
