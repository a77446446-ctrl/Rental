const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('техническая страница сохраняет вход администратора и настройки чата', () => {
  const html = read('public/maintenance.html');
  const server = read('src/server.js');
  const adminEntry = read('public/js/admin-entry.js');

  assert.match(server, /res\.status\(503\)\.sendFile/);
  assert.match(html, /id="main-logo-link"/);
  assert.match(html, /\/js\/api\.js/);
  assert.match(html, /\/js\/admin-entry\.js/);
  assert.match(html, /\/js\/maintenance\.js/);
  assert.match(html, /\/js\/chat\.js/);
  assert.match(adminEntry, /clicks >= 6/);
});

test('техническая страница показывает логотип CMS, короткий текст и не перекрывает его мобильным чатом', () => {
  const html = read('public/maintenance.html');
  const styles = read('public/css/maintenance.css');
  const script = read('public/js/maintenance.js');

  assert.match(html, /id="maintenance-hero-logo"/);
  assert.match(html, /Проводятся<br>технические работы/);
  assert.match(html, /Совсем скоро снова будем на связи/);
  assert.match(html, /обратиться через наш чат и задать любой вопрос/);
  assert.doesNotMatch(html, /maintenance-illustration|Наводим уют|Бережно обновляем/);
  assert.match(script, /heroLogo\.src = logoUrl/);
  assert.match(styles, /\.maintenance-page #chat-toggle \.chat-ring-label[\s\S]*animation: maintenance-chat-ring-orbit 12s linear infinite !important/);
  assert.match(styles, /\.maintenance-page \.chat-widget:has\([\s\S]*#chat-toggle > svg:not\(\.chat-ring-label\)[\s\S]*animation: maintenance-chat-icon-flip 6\.8s/);
  assert.match(styles, /\.maintenance-page \.chat-widget:has\([\s\S]*right: 18px !important;[\s\S]*bottom: calc\(18px \+ env\(safe-area-inset-bottom\)\) !important/);
});
test('основная и техническая страницы используют единый вход по логотипу', () => {
  const index = read('public/index.html');
  const main = read('public/js/main.js');

  assert.match(index, /\/js\/admin-entry\.js/);
  assert.doesNotMatch(main, /logoClicks/);
});
test('шесть быстрых нажатий по логотипу открывают вход администратора', () => {
  let clickHandler;
  let destination = '';
  const logo = {
    addEventListener(type, handler) {
      if (type === 'click') clickHandler = handler;
    },
  };
  const context = {
    document: { getElementById: () => logo },
    window: { location: { assign: (url) => { destination = url; } } },
    setTimeout: () => 1,
    clearTimeout: () => {},
  };

  vm.runInNewContext(read('public/js/admin-entry.js'), context);
  for (let index = 0; index < 6; index += 1) {
    clickHandler({ preventDefault() {} });
  }

  assert.equal(destination, '/admin/login');
});
