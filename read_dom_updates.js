const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
const idx = lines.findIndex(l => l.includes('function updateCheckoutSummary'));
console.log(lines.slice(idx+40, idx+70).join('\n'));
