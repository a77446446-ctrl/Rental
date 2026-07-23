const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function pngSize(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG', relativePath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('PWA manifest uses standalone mode and full-size application icons', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));

  assert.deepEqual(pngSize('public/icons/icon-192.png'), { width: 192, height: 192 });
  assert.deepEqual(pngSize('public/icons/icon-512.png'), { width: 512, height: 512 });
  assert.deepEqual(pngSize('public/icons/maskable-512.png'), { width: 512, height: 512 });
});

test('installation invitation supports native install, iOS and installed mode', () => {
  const source = read('public/js/pwa.js');
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /appinstalled/);
  assert.match(source, /display-mode: standalone/);
  assert.match(source, /На экран Домой/);
  assert.match(source, /PROMPT_DELAY = 18000/);
  assert.match(source, /\/api\/pwa-icon\/192\.png/);
});

test('home page and dynamic manifest use the administrator logo icons', () => {
  const html = read('public/index.html');
  const routes = read('src/routes/public.routes.js');
  assert.match(html, /apple-touch-icon" sizes="192x192" href="\/api\/pwa-icon\/192\.png"/);
  assert.match(routes, /\/api\/pwa-icon\/192\.png\?v=/);
  assert.match(routes, /\/api\/pwa-icon\/512\.png\?v=/);
  assert.match(routes, /sharp\(source\)/);
  assert.match(html, /main\.css\?v=20260723-8/);
  assert.match(html, /pwa\.js\?v=20260723-8/);
});
