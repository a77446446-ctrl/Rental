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
  assert.doesNotMatch(main, /'routePanelControl'/);
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
test('после завершения диапазона мобильный календарь плавно переводит к заявке', () => {
  const main = read('public/js/main.js');
  const layout = read('public/css/mobile-layout.css');

  assert.ok(main.includes('function scrollToCheckoutAfterDateSelection(checkIn, checkOut)'));
  assert.ok(main.includes("checkoutCard.scrollIntoView({ behavior: 'smooth', block: 'start' })"));
  assert.ok(main.includes('scrollToCheckoutAfterDateSelection(checkIn, checkOut)'));
  assert.ok(main.includes("classList.toggle('has-dates', state.selectedDates.length > 0)"));
  assert.ok(layout.includes('#checkoutDatesInfo.has-dates'));
  assert.ok(layout.includes('scroll-margin-top: 76px'));
});

test('иконка чата центрирована отдельно от кольца с текстом администратора', () => {
  const chat = read('public/js/chat.js');
  const css = read('public/css/mobile-app.css');
  const layout = read('public/css/mobile-layout.css');

  assert.ok(chat.includes('settings.chatWidgetText'));
  assert.ok(chat.includes('function buildChatRingLabel(value)'));
  assert.ok(chat.includes('class="chat-glyph"'));
  assert.ok(css.includes('#chat-toggle .chat-glyph'));
  assert.ok(css.includes('left: 50% !important'));
  assert.ok(css.includes('transform: translate(-50%, -50%) !important'));
  assert.ok(chat.includes('--chat-char-angle:'));
  assert.ok(chat.includes('var step = 360 / characters.length'));
  assert.ok(css.includes('--chat-ring-offset: -31px'));
  assert.ok(css.includes('translateY(var(--chat-ring-offset))'));
  assert.ok(css.includes('animation: eco-chat-glyph-pulse 2.4s'));
  assert.ok(!chat.includes('<textPath'));
  assert.ok(css.includes('.chat-glyph::before'));
  assert.ok(css.includes('24s linear infinite'));
  assert.ok(layout.includes('font-size: 13px !important'));
  assert.ok(layout.includes('white-space: nowrap'));
});
test('пустой блок дополнительных услуг скрывается для выбранного дома', () => {
  const main = read('public/js/main.js');

  assert.ok(main.includes("els.extrasContainer.closest('.booking-extras-disclosure')"));
  assert.ok(main.includes('state.amenities[state.selectedCabinId]'));
  assert.ok(main.includes("allowedServices.has(String(service.id || '').trim())"));
  assert.ok(main.includes('disclosure.hidden = availableServices.length === 0'));
  assert.ok(!main.includes('Дополнительные услуги пока не добавлены'));
});

test('цвет и подпись кнопки строго берутся из настроек администратора', () => {
  const chat = read('public/js/chat.js');
  const css = read('public/css/mobile-app.css');

  assert.ok(chat.includes("setAttribute('data-chat-color', settings.chatWidgetColor)"));
  assert.ok(chat.includes("String(settings.chatWidgetText || '').trim().slice(0, 30)"));
  assert.ok(!chat.includes("slice(0, 48) || 'Связаться с нами'"));
  ['green', 'blue', 'red', 'yellow'].forEach((color) => {
    assert.ok(css.includes(`[data-chat-color="${color}"]`));
  });
  assert.ok(css.includes('linear-gradient(145deg, var(--chat-fab-light), var(--chat-fab-main) 58%, var(--chat-fab-dark))'));
  assert.ok(css.includes('--chat-fab-light: #6b8e9e'));
  assert.ok(css.includes('--chat-fab-main: #3a6a8a'));
});