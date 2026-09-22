const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const s1 = "if (els.quickCheckIn) els.quickCheckIn.value = checkIn || '';";
const s2 = "if (els.quickCheckOut) els.quickCheckOut.value = checkOut || '';";

js = js.replace(s1, '');
js = js.replace(s2, '');

const s3 = "window.showToast('Пожалуйста, выберите даты в календаре', 'error');";
const idx = js.indexOf(s3);
if (idx !== -1) {
    const returnIdx = js.indexOf('return;', idx);
    const braceIdx = js.indexOf('}', returnIdx);
    if (braceIdx !== -1) {
        const p1 = js.slice(0, braceIdx + 1);
        const p2 = js.slice(braceIdx + 1);
        const insert = `
        const withPetsCb = document.getElementById('checkoutWithPets');
        if (withPetsCb && withPetsCb.checked) {
          const dogCb = document.getElementById('checkoutPetDog');
          const catCb = document.getElementById('checkoutPetCat');
          const hasDog = dogCb && dogCb.checked;
          const hasCat = catCb && catCb.checked;
          
          if (!hasDog && !hasCat) {
            window.showToast('Пожалуйста, выберите тип питомца (собаку или кошку)', 'error');
            const typesContainer = document.getElementById('checkoutPetTypesContainer');
            if (typesContainer) {
              typesContainer.style.border = '1px solid red';
              typesContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => typesContainer.style.border = '', 2500);
            }
            return;
          }
        }
`;
        js = p1 + insert + p2;
    }
}

fs.writeFileSync('public/js/main.js', js);
console.log('patched successfully using string match');
