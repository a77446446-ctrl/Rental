const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeBookingRecord,
  toDateOnly,
  toPocketBaseDate,
} = require('../src/utils/bookingRecord');
const { normalizePriceRecord } = require('../src/utils/priceRecord');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('даты бронирования PocketBase преобразуются в контракт сайта', () => {
  const booking = normalizeBookingRecord({
    id: 'booking-1',
    check_in_date: '2026-08-23 00:00:00.000Z',
    check_out_date: '2026-08-25 00:00:00.000Z',
  });

  assert.equal(booking.check_in, '2026-08-23');
  assert.equal(booking.check_out, '2026-08-25');
  assert.equal(toDateOnly('2026-08-23T12:30:00.000Z'), '2026-08-23');
  assert.equal(toPocketBaseDate('2026-08-25'), '2026-08-25 00:00:00.000Z');
});

test('API доступности фильтрует реальные поля дат PocketBase', () => {
  const source = read('src/routes/public.routes.js');

  assert.match(source, /check_in_date <=/);
  assert.match(source, /check_out_date >=/);
  assert.match(source, /fields: 'check_in_date,check_out_date'/);
  assert.doesNotMatch(source, /&& check_in <=/);
});

test('дата специальной цены совпадает с календарным днём сайта', () => {
  const price = normalizePriceRecord({
    id: 'price-1',
    date: '2026-08-23 00:00:00.000Z',
    custom_price: 10000,
  });

  assert.equal(price.date, '2026-08-23');

  const publicRoutes = read('src/routes/public.routes.js');
  const adminPrices = read('src/controllers/admin/prices.controller.js');
  const bookingPricing = read('src/services/bookingPricing.service.js');

  assert.match(publicRoutes, /priceMap\[price\.date\] = price/);
  assert.match(adminPrices, /data\.map\(normalizePriceRecord\)/);
  assert.match(adminPrices, /date: toPocketBaseDate\(date\)/);
  assert.match(bookingPricing, /result\.map\(normalizePriceRecord\)/);
});

test('создание брони защищено от пересечения и сохраняет оба канала уведомлений', () => {
  const service = read('src/services/booking.service.js');
  const controller = read('src/controllers/admin/bookings.controller.js');

  assert.match(service, /check_in_date < .*data\.check_out/);
  assert.match(service, /check_out_date > .*data\.check_in/);
  assert.match(service, /maxService\.sendBookingNotification\(notificationData\)/);
  assert.match(service, /sendBookingNotification\(notificationData\)/);
  assert.match(controller, /updateData\.check_in_date = toPocketBaseDate\(check_in\)/);
  assert.match(controller, /updateData\.check_out_date = toPocketBaseDate\(check_out\)/);
});
