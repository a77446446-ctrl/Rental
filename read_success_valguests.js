const fs = require('fs');
const t = fs.readFileSync('public/success.html', 'utf8');
const idx = t.indexOf("document.getElementById('valGuests').textContent");
console.log(t.slice(idx-200, idx+200));
