const fs = require('fs');
const t = fs.readFileSync('public/js/admin-cabins.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('function checkChanges'));
console.log(lines.slice(idx, idx+30).join('\n'));
