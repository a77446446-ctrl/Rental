const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('async function selectCabin'));
console.log(lines.slice(idx, idx+40).join('\n'));
