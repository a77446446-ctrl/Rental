const fs = require('fs');
const t = fs.readFileSync('public/index.html', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('Предварительно'));
console.log(lines.slice(idx-2, idx+4).join('\n'));
