const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
console.log('=== 1 ===');
console.log(lines.slice(653, 675).join('\n'));
console.log('=== 2 ===');
console.log(lines.slice(795, 825).join('\n'));
