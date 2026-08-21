const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('стартовый экран использует логотип администратора вместо дерева', () => {
  const html = read('public/index.html');
  const css = read('public/css/main.css');

  assert.doesNotMatch(html, /tree-loader\.js|<canvas id="scene"/);
  assert.match(html, /id="app-loading-logo"[^>]+\/api\/pwa-icon\/512\.png/);
  assert.match(html, /id="app-loading-title"/);
  assert.match(html, /id="app-loading-welcome">Добро пожаловать/);
  assert.match(css, /animation:\s*app-splash-depth 5s/);
});

test('страница открывается только после данных и пяти секунд заставки', () => {
  const main = read('public/js/main.js');

  assert.match(main, /SPLASH_MIN_DURATION_MS\s*=\s*5000/);
  assert.match(main, /await waitForSplashMinimum\(\);\s*hideAppLoading\(\)/);
  assert.doesNotMatch(main, /loadingDeadline|показываем страницу без полных данных/);
  assert.match(main, /fetchRequiredApiData\('\/api\/cabins'\)/);
  assert.match(main, /fetchRequiredApiData\('\/api\/mainpage'\)/);
});

test('offline-состояние не раскрывает пустой интерфейс', () => {
  const main = read('public/js/main.js');
  const css = read('public/css/main.css');
  const worker = read('public/sw.js');

  assert.match(main, /navigator\.onLine === false/);
  assert.match(main, /Извините, нет подключения к интернету/);
  assert.match(css, /body\.app-loading-active:not\(\.maintenance-mode\) > :not\(\.app-loading\):not\(script\)/);
  assert.match(worker, /pwa-icon\\\/\(\?:192\|512\)/);
  assert.match(worker, /\/css\/main\.css\?v=20260821-1/);
  assert.match(worker, /\/css\/mobile-app\.css\?v=20260821-1/);
  assert.match(worker, /\/css\/mobile-layout\.css\?v=20260821-1/);
  assert.match(worker, /\/js\/main\.js\?v=20260821-2/);
});

test('закрытие чата сразу возвращает компактную кнопку без pop-анимации', () => {
  const chat = read('public/js/chat.js');

  assert.match(chat, /function setChatOpen\(open\)/);
  assert.match(chat, /els\.body\.hidden = open === false/);
  assert.doesNotMatch(chat, /classList\.add\('fab-appear'\)/);
});
