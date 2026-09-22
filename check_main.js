const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
console.log('Total lines:', lines.length);
console.log(lines.slice(1200, 1260).join('\n'));
