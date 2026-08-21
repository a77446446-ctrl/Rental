const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('форма переводит гостя к первому незаполненному контакту', () => {
  const html = read('public/index.html');
  const main = read('public/js/main.js');

  assert.match(html, /<form id="checkoutForm"[^>]+novalidate/);
  assert.match(main, /showBookingFieldError\(guestNameInput, 'Введите имя'\)/);
  assert.match(main, /showBookingFieldError\(guestPhoneInput, 'Введите телефон'\)/);
  assert.match(main, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\)/);
  assert.doesNotMatch(main, /function checkFormValidity/);
});

test('пользовательский комментарий проходит в админку и MAX отдельно от числа гостей', () => {
  const main = read('public/js/main.js');
  const bookingService = read('src/services/booking.service.js');
  const admin = read('public/js/admin-bookings.js');
  const max = read('src/services/max.service.js');

  assert.match(main, /comment: commentField/);
  assert.doesNotMatch(main, /Количество гостей:.*Комментарий:/);
  assert.match(bookingService, /comment: data\.comment \? data\.comment\.replace/);
  assert.match(admin, /data-label="Комментарий"/);
  assert.match(max, /📝 Комментарий:/);
  assert.match(max, /Открыть заявку в админке:/);
});
