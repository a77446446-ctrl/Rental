const fs = require('fs');
const t = fs.readFileSync('src/routes/chat.routes.js', 'utf8');
const idx = t.indexOf('/upload');
console.log(t.slice(idx, idx+1500));
