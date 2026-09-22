const fs = require('fs');
let js = fs.readFileSync('public/js/main.js', 'utf8');

// 1. Fix the guest stepper
// Find guestsControl.addEventListener('click', ...)
// and add updateCheckoutSummary();
const stepperRegex = /guestsControl\.addEventListener\('click',\s*function\(e\)\s*\{[\s\S]*?setCheckoutGuests\(next\);\s*\}\);/;

const stepperMatch = js.match(stepperRegex);
if (stepperMatch) {
  const newStepper = stepperMatch[0].replace('setCheckoutGuests(next);', 'setCheckoutGuests(next);\n        updateCheckoutSummary();');
  js = js.replace(stepperRegex, newStepper);
  console.log('patched stepper listener');
} else {
  console.log('stepper listener not found!');
}

// 2. Fix the select-cabin-btn in performQuickSearch and renderCabins
// Let's replace ALL .select-cabin-btn listeners to make absolutely sure they set dates correctly

// Just find all occurrences of document.querySelectorAll('.select-cabin-btn').forEach
// It's tricky to regex replace the entire block. Let's use string replace.

const block1 = `        // Обработчики кнопок "Выбрать"
        document.querySelectorAll('.select-cabin-btn').forEach(function(btn) {
          btn.addEventListener('click', async function(e) {
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
          });
        });`;

const block2 = `      // Обработчики кнопок "Выбрать"
      document.querySelectorAll('.select-cabin-btn').forEach(function(btn) {
        btn.addEventListener('click', async function(e) {
          var cid = e.target.getAttribute('data-id');
          await selectCabin(cid);
          if (els.quickGuests) setCheckoutGuests(els.quickGuests.value);
          
          // Если есть выбранные даты в быстром поиске, установим их
          var quickIn = els.quickCheckIn ? els.quickCheckIn.value : null;
          var quickOut = els.quickCheckOut ? els.quickCheckOut.value : null;
          if (quickIn && quickOut && calendar) {
             // Используем метод календаря, если он есть
             if (typeof calendar.setSelection === 'function') {
               calendar.setSelection(quickIn, quickOut);
             }
          }

          // Скролл к календарю
          document.querySelector('#calendar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });`;

const uniformBlock = `        // Обработчики кнопок "Выбрать"
        document.querySelectorAll('.select-cabin-btn').forEach(function(btn) {
          btn.addEventListener('click', async function(e) {
            var cid = e.target.getAttribute('data-id');
            await selectCabin(cid);
            if (els.quickGuests) setCheckoutGuests(els.quickGuests.value);
            
            var quickIn = els.quickCheckIn ? els.quickCheckIn.value : null;
            var quickOut = els.quickCheckOut ? els.quickCheckOut.value : null;
            if (quickIn && quickOut && calendar) {
               if (typeof calendar.setSelection === 'function') {
                 calendar.setSelection(quickIn, quickOut);
               }
            }
            
            // Force update summary just in case dates were populated
            updateCheckoutSummary();
            
            var calendarEl = document.querySelector('#calendar');
            if (calendarEl) {
              calendarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        });`;

if (js.includes(block1)) {
  js = js.replace(block1, uniformBlock);
  console.log('patched block 1');
} else {
  console.log('block 1 not found');
}

if (js.includes(block2)) {
  js = js.replace(block2, uniformBlock.replace(/        /g, '      '));
  console.log('patched block 2');
} else {
  console.log('block 2 not found');
}

fs.writeFileSync('public/js/main.js', js);
console.log('done patching');
