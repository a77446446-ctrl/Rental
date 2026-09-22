const fs = require('fs');
const t = fs.readFileSync('public/js/main.js', 'utf8');
const lines = t.split('\n');
lines.forEach((l, i) => { if(l.toLowerCase().includes('flatpickr') || l.toLowerCase().includes('date') || l.includes('fp')) console.log(i, l.trim()); });
