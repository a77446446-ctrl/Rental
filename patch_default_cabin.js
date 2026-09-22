const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const emptySelectionLogic = `
    if (preselectId && state.cabins.find(c => c.id === preselectId)) {
      await selectCabin(preselectId);
      if (window.location.hash === '#calendar') {
        setTimeout(function() {
          document.querySelector('#calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } else {
      // By default do NOT select any cabin!
      await selectCabin('');
    }
`;
js = js.replace(/if \(preselectId && state\.cabins\.find\(c => c\.id === preselectId\)\) \{[\s\S]*?\} else if \(state\.cabins\.length > 0\) \{\s*await selectCabin\(state\.cabins\[0\]\.id\);\s*\}/, emptySelectionLogic.trim());


// Now we must ensure `selectCabin('')` works.
// In `selectCabin(cabinId)`:
const selectCabinReplacement = `
  async function selectCabin(cabinId) {
    state.selectedCabinId = cabinId || "";
    els.quickHouse.value = cabinId || "";
    updateQuickTotal();
    setCheckoutGuests(els.checkoutGuests ? els.checkoutGuests.value : (els.quickGuests ? els.quickGuests.value : 2));
    
    var cabin = cabinId ? state.cabins.find(function(c) { return c.id === cabinId || c.c_id === cabinId; }) : null;
    if (calendar) {
      if (cabin) {
        await calendar.setCabin(cabin.id, cabin.name, cabin.base_price);
      } else {
        // If no cabin, just clear it
        await calendar.setCabin('', 'Домик не выбран', 0);
      }
    }
`;
js = js.replace(/async function selectCabin\(cabinId\) \{[\s\S]*?if \(cabin && calendar\) \{\s*await calendar\.setCabin\(cabin\.id, cabin\.name, cabin\.base_price\);\s*\}/, selectCabinReplacement.trim());


// Also update "Найти свободные даты" logic.
// The user says "и когда ты уже выбираешь там, какой долг тебе надо тогда показана сумма и соответственно, найти свободный дом, после чего перемещается свободные дома, которые есть, и эта сумма уже и дата. Которых была выбрана."
// So when clicking "Найти свободные даты" (btnQuickSearch), it should scroll down, AND if a cabin was chosen, set the calendar. 
// Let's see what btnQuickSearch does.
fs.writeFileSync('public/js/main.js', js);
console.log('patched selectCabin default');
