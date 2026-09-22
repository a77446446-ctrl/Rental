const fs = require('fs');
let js = fs.readFileSync('public/success.html', 'utf8');

const target = `document.getElementById('valGuests').textContent = payload.guests_count || 'Не указано';`;
const replacement = `let guestsText = payload.guests_count || 'Не указано';
          if (payload.with_pets) {
            if (payload.pet_types && payload.pet_types.length > 0) {
              const types = payload.pet_types.map(t => t === 'dog' ? 'собака' : (t === 'cat' ? 'кошка' : t)).join(', ');
              guestsText += \` (+ питомцы: \${types})\`;
            } else {
              guestsText += ' (+ питомец)';
            }
          }
          document.getElementById('valGuests').textContent = guestsText;`;

if(js.includes(target)) {
    js = js.replace(target, replacement);
    fs.writeFileSync('public/success.html', js);
    console.log('patched success.html');
} else {
    console.log('Target not found in success.html');
}
