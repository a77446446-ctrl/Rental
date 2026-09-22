const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

// Change 1
const target1 = `          if (els.quickCheckIn) els.quickCheckIn.value = checkIn || '';
          if (els.quickCheckOut) els.quickCheckOut.value = checkOut || '';`;
if (js.includes(target1)) {
    js = js.replace(target1, '');
} else {
    console.log('target1 not found!');
}

// Change 2
const target2 = `        if (!state.currentCalc) {
          window.showToast('Пожалуйста, выберите даты в календаре', 'error');
          return;
        }`;
const replacement2 = `        if (!state.currentCalc) {
          window.showToast('Пожалуйста, выберите даты в календаре', 'error');
          return;
        }

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
              typesContainer.classList.add('pulse-error');
              typesContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => typesContainer.classList.remove('pulse-error'), 2000);
            }
            return;
          }
        }`;

if (js.includes(target2)) {
    js = js.replace(target2, replacement2);
} else {
    console.log('target2 not found!');
}

fs.writeFileSync('public/js/main.js', js);
console.log('Applied fixes safely to main.js');
