const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

const oldListener = `btn.addEventListener('click', function(e) {
            var cid = e.target.getAttribute('data-id');
            selectCabin(cid);
            if (els.quickGuests) setCheckoutGuests(els.quickGuests.value);
            
            var quickIn = els.quickCheckIn ? els.quickCheckIn.value : null;
            var quickOut = els.quickCheckOut ? els.quickCheckOut.value : null;
            if (quickIn && quickOut && calendar) {
               if (typeof calendar.setSelection === 'function') {
                 calendar.setSelection(quickIn, quickOut);
               }
            }
          });`;

const newListener = `btn.addEventListener('click', async function(e) {
            var cid = e.target.getAttribute('data-id');
            await selectCabin(cid);
            if (els.quickGuests) setCheckoutGuests(els.quickGuests.value);
            
            var quickIn = els.quickCheckIn ? els.quickCheckIn.value : null;
            var quickOut = els.quickCheckOut ? els.quickCheckOut.value : null;
            if (quickIn && quickOut && calendar) {
               if (typeof calendar.setSelection === 'function') {
                 calendar.setSelection(quickIn, quickOut);
                 setTimeout(function() {
                    calendar.setSelection(quickIn, quickOut);
                    updateCheckoutSummary();
                 }, 300); // safety fallback after availability loads
               }
            }
            
            var calendarEl = document.querySelector('#calendar');
            if (calendarEl) {
              calendarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });`;

js = js.replace(oldListener, newListener);

// wait, is there another selectCabin call without await?
// Let's replace ANY btn.addEventListener('click', function(e) { var cid... with async

const selectCabinBtnRegex = /btn\.addEventListener\('click',\s*function\s*\(\s*e\s*\)\s*\{\s*var\s*cid\s*=\s*e\.target\.getAttribute\('data-id'\);\s*selectCabin\(cid\);[\s\S]*?\}\);/g;

js = js.replace(selectCabinBtnRegex, newListener);

fs.writeFileSync('public/js/main.js', js);
console.log('patched async selectCabin in btn listener');
