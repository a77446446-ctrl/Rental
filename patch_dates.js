const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

// Fix updateQuickTotal
const quickTotalLogic = `function updateQuickTotal() {
    var cabinId = els.quickHouse.value;
    var checkIn = els.quickCheckIn ? els.quickCheckIn.value : null;
    var checkOut = els.quickCheckOut ? els.quickCheckOut.value : null;
    
    if (!cabinId || !checkIn || !checkOut) {
      els.quickTotal.textContent = '—';
      return;
    }
    var cabin = state.cabins.find(function(c) { return c.c_id === cabinId || c.id === cabinId; });
    if (cabin) {
      // Calculate nights
      var d1 = new Date(checkIn);
      var d2 = new Date(checkOut);
      var nights = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (nights <= 0 || isNaN(nights)) nights = 0;
      
      var rentSum = cabin.base_price * nights;
      // Add extra guests
      var guests = parseInt(els.quickGuests ? els.quickGuests.value : 2);
      var baseGuests = cabin.base_guests || cabin.capacity || 1;
      var extraGuestPrice = cabin.extra_guest_price || 0;
      if (guests > baseGuests && extraGuestPrice > 0 && nights > 0) {
        rentSum += (guests - baseGuests) * extraGuestPrice * nights;
      }
      
      els.quickTotal.textContent = nights > 0 ? EcoApi.formatPrice(rentSum) : '—';
    } else {
      els.quickTotal.textContent = '—';
    }
  }`;

js = js.replace(/function updateQuickTotal\(\) \{[\s\S]*?\}\s*(?=\/\*\*|\n\s*async function selectCabin)/, quickTotalLogic + '\n\n  ');


// Fix updateCheckoutSummary to check state.selectedDates.length
// Around line 380:
// var rentSum = 0;
// if (state.selectedDates.length > 0) { ...
// } else {
//   var cabin = state.cabins.find(function(c) { return c.id === state.selectedCabinId; });
//   if (cabin) {
//     rentSum = cabin.base_price * 2;
//   }
// }

const checkoutSummaryRegex = /\} else \{\s*var cabin = state\.cabins\.find\(function\(c\) \{ return c\.id === state\.selectedCabinId; \}\);\s*if \(cabin\) \{\s*rentSum = cabin\.base_price \* 2;\s*\}\s*\}/;

const emptyRentSum = `} else {
      // If no dates selected, price should be 0 or wait for dates
      rentSum = 0;
    }`;

js = js.replace(checkoutSummaryRegex, emptyRentSum);

// Also we should ensure extras don't calculate if no dates selected.
const extrasNightsRegex = /var nights = state\.selectedDates\.length > 0 \? state\.selectedDates\.length : 2;/;
const strictNights = `var nights = state.selectedDates.length;
      if (nights === 0) return; // Don't calculate extras if no dates chosen! (or we calculate but nights=0)
      `;

// Wait, if nights === 0, then we shouldn't show extras for pets/guests. But what about checkboxes (extra services)? Those don't depend on nights. So we just set nights = state.selectedDates.length; and let it multiply by 0 if 0 nights. 
// But wait, if nights is 0, pet price "per_stay" will still add `petPrice`. We should wrap the guests/pets in `if (nights > 0)`.

const extrasLogicReplace = `var nights = state.selectedDates.length;
      var guests = parseInt(els.checkoutGuests.value) || 2;
      var baseGuests = cabin.base_guests || cabin.capacity || 1;
      var extraGuestPrice = cabin.extra_guest_price || 0;
      if (nights > 0 && guests > baseGuests && extraGuestPrice > 0) {
        var extraGuests = guests - baseGuests;
        var guestTotal = extraGuests * extraGuestPrice * nights;
        extrasSum += guestTotal;
        extrasBreakdown.push(\`\${extraGuests} доп. гостя/ей (\${nights} ноч.): \${guestTotal} ₽\`);
      }
      var withPets = document.getElementById('checkoutWithPets') ? document.getElementById('checkoutWithPets').checked : false;
      if (withPets) {
        var dogChecked = document.getElementById('checkoutPetDog') ? document.getElementById('checkoutPetDog').checked : false;
        var catChecked = document.getElementById('checkoutPetCat') ? document.getElementById('checkoutPetCat').checked : false;
        if (dogChecked || catChecked) {
          var petPrice = cabin.pet_price || 0;
          if (petPrice > 0 && nights > 0) {
            var totalPetPrice = (cabin.pet_price_type === 'per_stay') ? petPrice : (petPrice * nights);
            extrasSum += totalPetPrice;
            extrasBreakdown.push(\`Питомцы: \${totalPetPrice} ₽\`);
          }
        }
      }`;

js = js.replace(/var nights = state\.selectedDates\.length > 0 \? state\.selectedDates\.length : 2;[\s\S]*?(?=\}\s*var checkboxes = document\.querySelectorAll\('\.extra-checkbox'\);)/, extrasLogicReplace + '\n      ');

fs.writeFileSync('public/js/main.js', js);
console.log('main.js dates logic patched');
