const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
console.log(lines.slice(1155, 1200).join('\n'));
