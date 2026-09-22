const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const target = `          if (els.quickCheckIn) els.quickCheckIn.value = checkIn || '';
          if (els.quickCheckOut) els.quickCheckOut.value = checkOut || '';`;

if (js.includes(target)) {
  js = js.replace(target, `          // Backward sync removed to prevent clearing Quick Search when changing houses
          // if (els.quickCheckIn && checkIn) els.quickCheckIn.value = checkIn;
          // if (els.quickCheckOut && checkOut) els.quickCheckOut.value = checkOut;`);
  fs.writeFileSync('public/js/main.js', js);
  console.log('patched successfully');
} else {
  console.log('could not find target string');
}
