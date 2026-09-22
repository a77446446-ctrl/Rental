const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

js = js.replace(/if \(els\.quickCheckIn\) els\.quickCheckIn\.value = checkIn \|\|[\r\n]+/g, '');
js = js.replace(/if \(els\.quickCheckOut\) els\.quickCheckOut\.value = checkOut \|\|[\r\n]+/g, '');

fs.writeFileSync('public/js/main.js', js);
console.log('Fixed syntax error');
