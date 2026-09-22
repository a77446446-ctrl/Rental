const fs = require('fs');
let js = fs.readFileSync('public/js/admin-bookings.js', 'utf8');

const target = `            <td data-label="Гость">
              <div class="guest-info">
                <strong>\${safeGuestName}</strong>
                <small>\${safeGuestPhone}</small>
                \${b.guest_telegram ? \`<small>@\${safeTelegram}</small>\` : ''}
              </div>
            </td>`;

const replacement = `            <td data-label="Гость">
              <div class="guest-info">
                <strong>\${safeGuestName}</strong>
                <small>\${safeGuestPhone}</small>
                \${b.guest_telegram ? \`<small>@\${safeTelegram}</small>\` : ''}
                <small style="color:var(--gold); margin-top: 4px;">Гостей: \${b.guests_count || 1}</small>
                \${b.with_pets ? \`<small style="color:var(--gold);">С питомцем (\${(b.pet_types || []).map(t => t === 'dog' ? 'собака' : (t === 'cat' ? 'кошка' : t)).join(', ') || 'указано'})</small>\` : ''}
              </div>
            </td>`;

if(js.includes(target)) {
    js = js.replace(target, replacement);
    fs.writeFileSync('public/js/admin-bookings.js', js);
    console.log('patched admin-bookings.js');
} else {
    console.log('Target not found in admin-bookings.js');
}
