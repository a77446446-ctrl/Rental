const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('чат использует единое состояние и один обработчик viewport', () => {
  const html = read('public/index.html');
  const chat = read('public/js/chat.js');
  const css = read('public/css/mobile-app.css');

  assert.match(html, /id="chat-body" hidden/);
  assert.match(chat, /function setChatOpen\(open\)/);
  assert.match(chat, /widget\.dataset\.state = nextState/);
  assert.equal((chat.match(/visualViewport\.addEventListener\('resize'/g) || []).length, 1);
  assert.doesNotMatch(chat, /els\.body\.style\.display/);
  assert.match(css, /chat-widget\[data-state="closed"\]/);
  assert.match(css, /chat-ring-label[\s\S]*eco-chat-ring-orbit/);
});

test('мобильная прокрутка не запускает глобальную обработку inline style', () => {
  const api = read('public/js/api.js');
  const main = read('public/js/main.js');

  assert.doesNotMatch(api, /attributeFilter:[^\n]+['"]style['"]/);
  assert.doesNotMatch(api, /querySelectorAll\([^\n]+\[style\]/);
  assert.doesNotMatch(main, /window\.scrollTo\(0, 0\)/);
  assert.match(main, /history\.scrollRestoration = 'auto'/);
});

test('карта остаётся встроенной и загружается только рядом с видимой областью', () => {
  const html = read('public/index.html');
  const main = read('public/js/main.js');

  assert.doesNotMatch(html, /api-maps\.yandex\.ru/);
  assert.match(main, /function loadYandexMapsApi\(\)/);
  assert.match(main, /rootMargin: '320px 0px'/);
  assert.doesNotMatch(main, /className = 'mobile-map-link'/);
  assert.match(main, /mapc\.dataset\.mapMode = 'interactive'/);
  assert.match(main, /'routePanelControl'/);
  assert.match(main, /featuresVisible === false \|\| document\.hidden/);
});

test('мобильная версия использует компактные раскрытия и отдельный лёгкий слой', () => {
  const html = read('public/index.html');
  const shell = read('public/js/mobile-shell.js');
  const layout = read('public/css/mobile-layout.css');

  assert.match(html, /booking-extras-disclosure/);
  assert.match(html, /mobile-app\.css/);
  assert.match(html, /mobile-layout\.css/);
  assert.match(shell, /extrasDisclosure\.removeAttribute\('open'\)/);
  assert.match(layout, /\.trust-strip \{ display: none/);
  assert.match(layout, /\.house-grid,[\s\S]*scroll-snap-type: x mandatory/);
  assert.match(layout, /\.feature-image \{ display: none/);
});

test('фотография дома проходит через медиапрокси', () => {
  const main = read('public/js/main.js');

  assert.equal((main.match(/window\.EcoMedia \? window\.EcoMedia\.url\(mainImg\.url\)/g) || []).length, 2);
  assert.equal((main.match(/var mainImageUrl = mainImg && mainImg\.url/g) || []).length, 2);
  assert.match(main, /encodeURI\(String\(mainImageUrl\)\)/);
  assert.doesNotMatch(main, /--img: url\('\$\{mainImg\.url\}/);
});

test('мобильные преимущества, карта и стрелка имеют стабильную геометрию', () => {
  const appCss = read('public/css/mobile-app.css');
  const layout = read('public/css/mobile-layout.css');

  assert.match(appCss, /summary::after[\s\S]*border-right: 2px solid var\(--gold\)/);
  assert.match(appCss, /\[open\] summary::after \{ transform: rotate\(225deg\)/);
  assert.match(layout, /@media \(max-width: 520px\)[\s\S]*\.feature-grid[\s\S]*grid-template-columns: 1fr !important/);
  assert.match(layout, /-webkit-line-clamp: 2/);
  assert.match(layout, /#contact-map-container[\s\S]*height: 260px !important/);
});
