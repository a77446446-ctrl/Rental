const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const { validateStay, cleanText, validateUuid, validateRecordId } = require('../src/utils/validation');
const { escapeHtml } = require('../src/utils/html');
const {
  parseIcsEvents,
  isPrivateAddress,
  syncSourceById,
  isExternalCalendarSchemaMissing,
} = require('../src/services/externalCalendar.service');
const storage = require('../src/services/storage.service');
const cabinMetadata = require('../src/services/cabinMetadata.service');
const chatService = require('../src/services/chat.service');
const { config } = require('../src/config/env');
const session = require('../src/services/adminSession.service');
const { requireAdmin } = require('../src/middleware/auth');
const { buildPocketbaseMediaUrl, toSameOriginMediaPath } = require('../src/routes/media.routes');

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

test('идентификатор записи принимает UUID и стандартный ID PocketBase', () => {
  assert.equal(validateRecordId('4489300c-4ba1-4292-a4e3-3f138040196d'), '4489300c-4ba1-4292-a4e3-3f138040196d');
  assert.equal(validateRecordId('a1b2c3d4e5f6g7h'), 'a1b2c3d4e5f6g7h');
  assert.throws(() => validateRecordId('bad-id" || true'), /неверный/);
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
  });
});

test('iCal network guard rejects local and private addresses', () => {
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('10.20.30.40'), true);
  assert.equal(isPrivateAddress('172.20.1.2'), true);
  assert.equal(isPrivateAddress('169.254.169.254'), true);
  assert.equal(isPrivateAddress('192.168.1.2'), true);
  assert.equal(isPrivateAddress('::1'), true);
  assert.equal(isPrivateAddress('fd00::1'), true);
  assert.equal(isPrivateAddress('fe80::1'), true);
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});

test('iCal admin API exposes source sync and explicit schema errors', () => {
  assert.equal(typeof syncSourceById, 'function');
  assert.equal(typeof isExternalCalendarSchemaMissing, 'function');
  assert.equal(isExternalCalendarSchemaMissing({ externalCalendarSchemaMissing: true }), true);
});

test('iCal export accepts stable cabin IDs and the admin explains both sync directions', () => {
  const root = path.join(__dirname, '..');
  const publicRoutes = fs.readFileSync(path.join(root, 'src/routes/public.routes.js'), 'utf8');
  const cabinsController = fs.readFileSync(path.join(root, 'src/controllers/admin/cabins.controller.js'), 'utf8');
  const cabinsPage = fs.readFileSync(path.join(root, 'public/admin/cabins.html'), 'utf8');
  assert.match(publicRoutes, /getOne\(cabinId/);
  assert.match(publicRoutes, /REFRESH-INTERVAL;VALUE=DURATION:PT30M/);
  assert.match(cabinsController, /saved\.external_calendars = externalCalendars/);
  assert.match(cabinsPage, /Шаг 1\. Экспорт Eco Gorniy → Avito/);
  assert.match(cabinsPage, /Шаг 2\. Импорт Avito → Eco Gorniy/);
});

test('storage cleanup accepts PocketBase media paths and rejects unrelated paths', () => {
  const url = 'https://pb.example.com/api/files/media/record123/photo.jpg';
  assert.equal(storage.extractStoragePath(url), 'record123');
  assert.equal(storage.isCabinPath(url), true);
  assert.equal(storage.isCabinPath('/api/files/chat/record123/photo.jpg'), false);
  assert.equal(storage.isCabinPath('../secret'), false);
});

test('public media proxy only targets the configured PocketBase origin', () => {
  const previousUrl = config.pocketbaseUrl;
  config.pocketbaseUrl = 'https://pb.example.com';
  try {
    assert.equal(
      buildPocketbaseMediaUrl('media/record123/photo one.jpg').href,
      'https://pb.example.com/api/files/media/record123/photo%20one.jpg'
    );
    assert.equal(
      toSameOriginMediaPath('https://pb.example.com/api/files/media/record123/photo%20one.jpg'),
      '/media/pocketbase/media/record123/photo%20one.jpg'
    );
    assert.equal(buildPocketbaseMediaUrl('../secret'), null);
  } finally {
    config.pocketbaseUrl = previousUrl;
  }
});

test('media uploads are identified by file signature instead of client MIME only', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000000000000', 'hex');
  assert.deepEqual(storage.detectMediaFile(png, 'image/png'), {
    mimeType: 'image/png', extension: 'png', mediaType: 'image',
  });
  assert.throws(
    () => storage.detectMediaFile(Buffer.from('this is not an image'), 'image/png'),
    /не поддерживается/
  );
});

test('chat photos are resized, converted to WebP and stripped of metadata', async () => {
  const source = await sharp({
    create: {
      width: 3200,
      height: 2400,
      channels: 3,
      background: { r: 42, g: 108, b: 62 },
    },
  })
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: 1 })
    .toBuffer();

  const optimized = await storage.optimizeChatImage(
    source,
    'Лес.JPG',
    storage.detectMediaFile(source, 'image/jpeg')
  );
  const metadata = await sharp(optimized.buffer).metadata();

  assert.equal(optimized.mimeType, 'image/webp');
  assert.equal(optimized.extension, 'webp');
  assert.equal(optimized.name, 'Лес.webp');
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width <= 1920);
  assert.ok(metadata.height <= 1920);
  assert.equal(metadata.exif, undefined);
  assert.ok(optimized.buffer.length < source.length);
});

test('cabin metadata normalizes selections and save-full synchronizes public stores', () => {
  assert.deepEqual(cabinMetadata.normalizeSelections([' Фен ', 'Фен', '', 'Посуда']), ['Фен', 'Посуда']);
  const root = path.join(__dirname, '..');
  const controller = fs.readFileSync(path.join(root, 'src/controllers/admin/cabins.controller.js'), 'utf8');
  const adminCabins = fs.readFileSync(path.join(root, 'public/js/admin-cabins.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'public/js/main.js'), 'utf8');
  const cabin = fs.readFileSync(path.join(root, 'public/js/cabin.js'), 'utf8');
  assert.match(controller, /saveCabinSelections\(\s*saved\.id,\s*selectedAmenities,\s*selectedTags\s*\)/);
  assert.match(adminCabins, /globalAmenities\[c\.id\].*c\.amenities/);
  assert.match(adminCabins, /globalCabinTags\[c\.id\].*c\.tags/);
  assert.match(main, /state\.amenities\[cabin\.id\].*cabin\.amenities/);
  assert.match(main, /state\.cabinTags\[cabin\.id\].*cabin\.tags/);
  assert.match(cabin, /amenitiesMap\[cabinId\][\s\S]*cabin\.amenities/);
});

test('Telegram webhook uses a timing-safe shared secret', () => {
  const previous = config.telegramWebhookSecret;
  config.telegramWebhookSecret = 'test_webhook_secret_1234567890';
  try {
    const secret = chatService.getTelegramWebhookSecret();
    assert.equal(chatService.isValidTelegramWebhook(secret), true);
    assert.equal(chatService.isValidTelegramWebhook('wrong-secret'), false);
  } finally {
    config.telegramWebhookSecret = previous;
  }
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
  const chatRoutes = fs.readFileSync(path.join(root, 'src/routes/chat.routes.js'), 'utf8');
  assert.doesNotMatch(publicRoutes, /total_price:\s*total_price/);
  assert.match(bookingService, /calculateBookingTotal/);
  assert.match(migration, /create_booking_atomic/);
  assert.match(migration, /save_cabin_full/);
  assert.match(migration, /replace_external_bookings/);
  assert.match(migration, /DROP POLICY IF EXISTS "Allow guests to read their own chats"/);
  assert.match(chatRoutes, /x-telegram-bot-api-secret-token/);
  assert.doesNotMatch(publicRoutes, /SUMMARY:Занято —/);
});

test('ordinary site traffic is not globally rate limited', () => {
  const root = path.join(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  const publicRoutes = fs.readFileSync(path.join(root, 'src/routes/public.routes.js'), 'utf8');
  const rateLimit = fs.readFileSync(path.join(root, 'src/middleware/rateLimit.js'), 'utf8');

  assert.doesNotMatch(server, /app\.use\(generalLimiter\)/);
  assert.doesNotMatch(publicRoutes, /router\.use\(apiLimiter\)/);
  assert.doesNotMatch(rateLimit, /Слишком много запросов\. Пожалуйста, подождите 15 минут\./);
  assert.match(rateLimit, /const authLimiter = rateLimit/);
  assert.match(rateLimit, /const chatUploadLimiter = rateLimit/);
});

test('chat always returns to the latest message after an update', () => {
  const chat = fs.readFileSync(path.join(__dirname, '..', 'public/js/chat.js'), 'utf8');
  assert.doesNotMatch(chat, /chat_booking_focus_until/);
  assert.doesNotMatch(chat, /scrollToPreferredPosition\(\)/);
  assert.match(chat, /requestAnimationFrame\(applyScroll\)/);
  assert.match(chat, /media\.addEventListener\('load', scrollToBottom/);
});

test('admin price calendar keeps holiday and action controls from overlapping', () => {
  const prices = fs.readFileSync(path.join(__dirname, '..', 'public/admin/prices.html'), 'utf8');
  assert.match(prices, /\.day-cell\.holiday::after\s*\{[\s\S]*position:\s*static/);
  assert.match(prices, /#calendarDays \.day-cell\s*\{[\s\S]*min-height:\s*58px\s*!important/);
  assert.match(prices, /\.price-actions \.btn\s*\{[\s\S]*position:\s*static\s*!important/);
  assert.match(prices, /\.price-actions #savePricesBtn\s*\{[\s\S]*margin-left:\s*auto\s*!important/);
});

test('PocketBase media is rewritten through the same-origin proxy', () => {
  const root = path.join(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  const apiClient = fs.readFileSync(path.join(root, 'public/js/api.js'), 'utf8');
  assert.match(server, /app\.use\('\/media', mediaRoutes\)/);
  assert.match(apiClient, /\/media\/pocketbase\//);
  assert.match(apiClient, /MutationObserver/);
});

test('all administrator images use the PocketBase media proxy', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'public/js/main.js'), 'utf8');
  assert.match(main, /mainpageMediaUrl\(data\.global_bg_url\)/);
  assert.match(main, /mainpageMediaUrl\(data\.hero\.background_url\)/);
  assert.match(main, /mainpageMediaUrl\(data\.territory\.background_url\)/);
  assert.match(main, /mainpageMediaUrl\(contacts\.background_url\)/);
  assert.match(main, /mainpageMediaUrl\(f\.image_url\)/);
});

test('territory content and local video modal keep valid UI targets', () => {
  const root = path.join(__dirname, '..');
  const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'public/js/main.js'), 'utf8');
  for (let indexNumber = 0; indexNumber < 3; indexNumber++) {
    assert.match(index, new RegExp(`id="territory-item-title-${indexNumber}"`));
    assert.match(index, new RegExp(`id="territory-item-desc-${indexNumber}"`));
  }
  assert.match(index, /id="territory-side-title"/);
  assert.match(main, /videoModalBody\.appendChild\(vid\)/);
  assert.doesNotMatch(main, /querySelector\('\.video-container'\)/);
});

test('GitHub Actions verifies tests, lint and production dependency audit', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
});

test('Yandex verification and search indexing files are present', () => {
  const publicDir = path.join(__dirname, '..', 'public');
  const verification = fs.readFileSync(path.join(publicDir, 'yandex_16b72d70203cd3ca.html'), 'utf8');
  const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
  const index = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  assert.match(verification, /Verification: 16b72d70203cd3ca/);
  assert.match(robots, /Sitemap: https:\/\/eco-gorniy\.ru\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/eco-gorniy\.ru\/<\/loc>/);
  assert.match(index, /rel="canonical" href="https:\/\/eco-gorniy\.ru\/"/);
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

test('admin login uses neutral credentials hints and provides a site exit', () => {
  const login = fs.readFileSync(path.join(__dirname, '..', 'public/admin/login.html'), 'utf8');
  assert.match(login, /placeholder="Введите логин"/);
  assert.doesNotMatch(login, /placeholder="admin"/);
  assert.match(login, /<a href="\/"[^>]*>Вернуться на главную<\/a>/);
});

test('ordinary refresh receives the current frontend release without Ctrl+F5', () => {
  const root = path.join(__dirname, '..');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  const pwa = fs.readFileSync(path.join(root, 'public/js/pwa.js'), 'utf8');
  const publicPages = [
    path.join(root, 'public/index.html'),
    path.join(root, 'public/cabin.html'),
    path.join(root, 'public/success.html'),
    ...fs.readdirSync(path.join(root, 'public/admin'))
      .filter((name) => name.endsWith('.html'))
      .map((name) => path.join(root, 'public/admin', name)),
  ];
  assert.match(server, /no-store, no-cache, must-revalidate/);
  assert.match(worker, /CACHE_VERSION = 'eco-gorniy-pwa-v\d+'/);
  assert.match(worker, /fetch\(request, \{ cache: 'no-store' \}\)/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(pwa, /updateViaCache: 'none'/);
  assert.match(pwa, /registration\.update\(\)/);
  assert.match(pwa, /controllerchange/);
  assert.match(pwa, /window\.location\.reload\(\)/);
  publicPages.forEach((pagePath) => {
    const html = fs.readFileSync(pagePath, 'utf8');
    assert.doesNotMatch(html, /v=20260716/, pagePath);
    if (/\/(?:css|js)\//.test(html)) {
      assert.match(html, /v=\d{8}(?:-\d+)?/, pagePath);
    }
  });
});
