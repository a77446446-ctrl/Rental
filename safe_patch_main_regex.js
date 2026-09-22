const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

js = js.replace(/if\s*\(els\.quickCheckIn\)\s*els\.quickCheckIn\.value\s*=\s*checkIn\s*\|\|\s*'';\s*if\s*\(els\.quickCheckOut\)\s*els\.quickCheckOut\.value\s*=\s*checkOut\s*\|\|\s*'';/g, '');

const t2 = /if\s*\(!state\.currentCalc\)\s*\{\s*window\.showToast\('Пожалуйста, выберите даты в календаре',\s*'error'\);\s*return;\s*\}/g;
const r2 = `        if (!state.currentCalc) {
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
              typesContainer.style.border = '1px solid red';
              typesContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => typesContainer.style.border = '', 2500);
            }
            return;
          }
        }`;
js = js.replace(t2, r2);

fs.writeFileSync('public/js/main.js', js);
console.log('Applied fixes safely to main.js via regex');
