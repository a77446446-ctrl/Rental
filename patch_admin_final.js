const fs = require('fs');

let js = fs.readFileSync('public/js/admin-cabins.js', 'utf8');

// Fix getFormData
const getFormHtml = `allow_pets: allowPetsField ? allowPetsField.checked : false,
      allowed_pet_types: [petDogField?.checked ? 'dog' : null, petCatField?.checked ? 'cat' : null].filter(Boolean),
      pet_price: petPriceField ? parseInt(petPriceField.value)||0 : 0,
      pet_price_type: petPriceTypeField ? petPriceTypeField.value : 'per_night',
      base_guests: baseGuestsField ? parseInt(baseGuestsField.value)||parseInt(capacityField.value)||1 : 1,
      extra_guest_price: extraGuestPriceField ? parseInt(extraGuestPriceField.value)||0 : 0,`;
js = js.replace(/allow_pets: allowPetsField\.checked,/, getFormHtml);

// Fix openEditModal
const openEditHtml = `allowPetsField.checked = c.allow_pets || false;
      if(petDogField) petDogField.checked = Array.isArray(c.allowed_pet_types) && c.allowed_pet_types.includes('dog');
      if(petCatField) petCatField.checked = Array.isArray(c.allowed_pet_types) && c.allowed_pet_types.includes('cat');
      if(petPriceField) petPriceField.value = c.pet_price || '';
      if(petPriceTypeField) petPriceTypeField.value = c.pet_price_type || 'per_night';
      if(baseGuestsField) baseGuestsField.value = c.base_guests || c.capacity || '';
      if(extraGuestPriceField) extraGuestPriceField.value = c.extra_guest_price || '';
      const petOptions = document.getElementById('admin-pet-options');
      if(petOptions) petOptions.style.display = c.allow_pets ? 'block' : 'none';`;
js = js.replace(/allowPetsField\.checked = c\.allow_pets \|\| false;/, openEditHtml);

fs.writeFileSync('public/js/admin-cabins.js', js);
console.log('patched admin-cabins.js completely');
