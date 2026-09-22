const fs = require('fs');
const t = fs.readFileSync('public/index.html', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('quickTotal'));
console.log(lines.slice(idx-25, idx).join('\n'));
