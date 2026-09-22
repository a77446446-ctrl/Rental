const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const quickTotalListeners = `
  if (els.quickGuests) els.quickGuests.addEventListener('change', updateQuickTotal);
  if (els.quickHouse) els.quickHouse.addEventListener('change', function() { selectCabin(this.value); });
  if (els.quickCheckIn) els.quickCheckIn.addEventListener('change', updateQuickTotal);
  if (els.quickCheckOut) els.quickCheckOut.addEventListener('change', updateQuickTotal);
`;

js = js.replace(/function updateQuickTotal/, quickTotalListeners + '\n  function updateQuickTotal');
fs.writeFileSync('public/js/main.js', js);
console.log('quick event listeners patched');
