const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const target = "window.showToast('Пожалуйста, выберите даты в календаре', 'error');";
const idx = js.indexOf(target);
if (idx !== -1) {
    const blockEnd = js.indexOf('return;', idx) + 7;
    const replacement = `
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
    js = js.slice(0, blockEnd + 1) + replacement + js.slice(blockEnd + 1);
    fs.writeFileSync('public/js/main.js', js);
    console.log('Patched main.js successfully');
} else {
    console.log('target not found');
}
