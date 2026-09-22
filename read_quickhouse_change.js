const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
console.log(lines.slice(675, 700).join('\n'));
