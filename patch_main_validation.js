const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const target = `        if (!state.currentCalc) {
          window.showToast('Пожалуйста, выберите даты в календаре', 'error');
          return;
        }`;

const replacement = `        if (!state.currentCalc) {
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
            window.showToast('Пожалуйста, выберите тип питомца (Собаку или Кошку)', 'error');
            const typesContainer = document.getElementById('checkoutPetTypesContainer');
            if (typesContainer) {
              typesContainer.classList.add('pulse-error');
              typesContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => typesContainer.classList.remove('pulse-error'), 2000);
            }
            return;
          }
        }`;

if(js.includes(target)) {
    js = js.replace(target, replacement);
    fs.writeFileSync('public/js/main.js', js);
    console.log('patched main.js with pet validation');
} else {
    console.log('Target not found in main.js');
}
