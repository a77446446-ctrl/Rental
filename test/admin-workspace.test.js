const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('bookings keep active work separate from the collapsible archive', () => {
  const html = read('public/admin/bookings.html');
  const js = read('public/js/admin-bookings.js');

  assert.match(html, /id="archivedBookingsTableBody"/);
  assert.match(html, /<details class="booking-archive"/);
  assert.doesNotMatch(html, /<td data-label="Действие" style="display:flex/);
  assert.match(js, /const activeBookings = data\.data\.filter/);
  assert.match(js, /const archivedBookings = data\.data\.filter/);
  assert.match(js, /<div class="booking-actions">/);
});

test('mobile chats expand the selected thread below its guest', () => {
  const html = read('public/admin/chats.html');
  const js = read('public/js/admin-chats.js');

  assert.match(html, /\.chat-thread\.is-mobile-open/);
  assert.match(js, /activeItem\.insertAdjacentElement\('afterend', chatThread\)/);
  assert.match(js, /selectedToken === item\.token/);
  assert.match(js, /!isMobileChat\(\)/);
});

test('analytics use collapsible panels and compact mobile guest cards', () => {
  const html = read('public/admin/analytics.html');
  const js = read('public/js/admin-analytics.js');

  assert.ok((html.match(/<details class="panel analytics-disclosure"/g) || []).length >= 4);
  assert.match(html, /\.analytics-mobile-guests \{ display: block !important; \}/);
  assert.match(js, /<details class="analytics-guest-card">/);
  assert.match(js, /analytics-desktop-guests/);
});
