const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { validateStay, cleanText, validateUuid } = require('../src/utils/validation');
const { escapeHtml } = require('../src/utils/html');
const { parseIcsEvents, isPrivateAddress } = require('../src/services/externalCalendar.service');
const storage = require('../src/services/storage.service');
const session = require('../src/services/adminSession.service');
const { requireAdmin } = require('../src/middleware/auth');

test('validateStay accepts a normal interval and rejects invalid dates', () => {
  assert.equal(validateStay('2026-07-13', '2026-07-16').nights, 3);
  assert.throws(() => validateStay('2026-02-30', '2026-03-02'), /несуществующая/);
  assert.throws(() => validateStay('2026-07-13', '2026-07-13'), /позже/);
  assert.throws(() => validateStay('2026-07-13', '2027-08-01'), /365/);
});

test('input helpers enforce lengths and UUID format', () => {
  assert.equal(cleanText('  Иван  ', { required: true }), 'Иван');
  assert.throws(() => cleanText('abcd', { max: 3 }), /не более/);
  assert.equal(validateUuid('4489300c-4ba1-4292-a4e3-3f138040196d'), '4489300c-4ba1-4292-a4e3-3f138040196d');
  assert.throws(() => validateUuid('not-an-id'), /неверный/);
});

test('HTML escaping neutralizes stored XSS payloads', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('iCal parser keeps valid Avito-style events and ignores cancelled events', () => {
  const events = parseIcsEvents([
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:avito-1',
    'SUMMARY:Занято',
    'DTSTART;VALUE=DATE:20260720',
    'DTEND;VALUE=DATE:20260723',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:cancelled',
    'STATUS:CANCELLED',
    'DTSTART;VALUE=DATE:20260725',
    'DTEND;VALUE=DATE:20260726',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n'));
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    uid: 'avito-1', summary: 'Занято', check_in: '2026-07-20', check_out: '2026-07-23',
    raw_event: { uid: 'avito-1', summary: 'Занято', dtstart: '20260720', dtend: '20260723' },
  });
});

test('iCal network guard rejects local and private addresses', () => {
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('10.20.30.40'), true);
  assert.equal(isPrivateAddress('192.168.1.2'), true);
  assert.equal(isPrivateAddress('8.8.8.8'), false);
});

test('storage cleanup accepts cabin paths and rejects chat traversal', () => {
  const url = 'https://project.supabase.co/storage/v1/object/public/cabin-photos/cabins/abc.jpg';
  assert.equal(storage.extractStoragePath(url), 'cabins/abc.jpg');
  assert.equal(storage.isCabinPath('cabins/abc.jpg'), true);
  assert.equal(storage.isCabinPath('chat/abc.jpg'), false);
  assert.equal(storage.isCabinPath('../secret'), false);
});

test('admin session payload is unique, expiring and carries CSRF token', () => {
  const cookies = [];
  const res = { cookie: (name, value, options) => cookies.push({ name, value, options }) };
  const first = session.setSessionCookies(res);
  const second = session.setSessionCookies(res);
  assert.notEqual(first.nonce, second.nonce);
  assert.ok(first.csrf);
  assert.equal(session.parseSession(JSON.stringify(first)).user, first.user);
  assert.equal(session.safeEqual(first.csrf, first.csrf), true);
  assert.equal(session.safeEqual(first.csrf, 'wrong'), false);
  assert.equal(cookies.find((cookie) => cookie.name === 'eco_admin_session').options.httpOnly, true);
});

test('admin mutation requires the CSRF header bound to its signed session', () => {
  const payload = session.setSessionCookies({ cookie: () => {} });
  let nextCalled = false;
  const req = {
    method: 'POST', originalUrl: '/api/admin/settings', signedCookies: { eco_admin_session: JSON.stringify(payload) },
    cookies: { eco_admin_csrf: payload.csrf }, body: {}, params: {}, ip: '127.0.0.1',
    get: (name) => name.toLowerCase() === 'x-csrf-token' ? payload.csrf : '',
  };
  const res = { once: () => {}, status: () => res, json: () => { throw new Error('must not reject'); } };
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const rejected = { statusCode: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  requireAdmin({ ...req, get: () => 'wrong' }, rejected, () => {});
  assert.equal(rejected.statusCode, 403);
});

test('critical contracts remain server-controlled in source', () => {
  const root = path.join(__dirname, '..');
  const publicRoutes = fs.readFileSync(path.join(root, 'src/routes/public.routes.js'), 'utf8');
  const bookingService = fs.readFileSync(path.join(root, 'src/services/booking.service.js'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'src/sql/006_stability_hardening.sql'), 'utf8');
  assert.doesNotMatch(publicRoutes, /total_price:\s*total_price/);
  assert.match(bookingService, /calculateBookingTotal/);
  assert.match(migration, /create_booking_atomic/);
  assert.match(migration, /save_cabin_full/);
  assert.match(migration, /replace_external_bookings/);
  assert.match(migration, /DROP POLICY IF EXISTS "Allow guests to read their own chats"/);
});

test('every admin page uses the unified responsive stylesheet', () => {
  const adminDir = path.join(__dirname, '..', 'public/admin');
  const pages = fs.readdirSync(adminDir).filter((name) => name.endsWith('.html'));
  assert.ok(pages.length >= 10);
  pages.forEach((name) => {
    const html = fs.readFileSync(path.join(adminDir, name), 'utf8');
    assert.match(html, /admin-responsive\.css/, name);
  });
});
