const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

// I will just replace the second petsContainer block or wrap it.
// The second block starts around `var petsContainer = document.getElementById('checkoutPetsContainer');` (the second time it appears)

const badLogic = `
    var petsContainer = document.getElementById('checkoutPetsContainer');
    var withPetsCb = document.getElementById('checkoutWithPets');
    var dogLabel = document.getElementById('checkoutPetDogLabel');
    var catLabel = document.getElementById('checkoutPetCatLabel');
    var petTypesCont = document.getElementById('checkoutPetTypesContainer');
    if (petsContainer) {
      if (cabin.allow_pets) {`;

const fixedLogic = `
    var petsContainer = document.getElementById('checkoutPetsContainer');
    var withPetsCb = document.getElementById('checkoutWithPets');
    var dogLabel = document.getElementById('checkoutPetDogLabel');
    var catLabel = document.getElementById('checkoutPetCatLabel');
    var petTypesCont = document.getElementById('checkoutPetTypesContainer');
    if (petsContainer) {
      if (cabin && cabin.allow_pets) {`;

js = js.replace(badLogic, fixedLogic);

fs.writeFileSync('public/js/main.js', js);
console.log('patched selectCabin type error');
