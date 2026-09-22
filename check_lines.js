const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
console.log(lines.slice(305, 345).join('\n'));
