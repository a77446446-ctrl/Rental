const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('PocketBase обновляет отклонённый токен один раз для параллельных запросов', async () => {
  let loginCount = 0;
  class PocketBase {
    constructor() {
      this.authStore = {
        token: 'старый',
        get isValid() { return Boolean(this.token); },
        clear() { this.token = ''; },
      };
    }

    collection() {
      return {
        authWithPassword: async () => {
          loginCount++;
          this.authStore.token = 'новый';
        },
      };
    }
  }

  const source = fs.readFileSync(path.join(__dirname, '../src/config/pocketbase.js'), 'utf8');
  const config = {
    pocketbaseUrl: 'http://127.0.0.1:8090',
    pocketbaseAdminEmail: 'test@example.org',
    pocketbaseAdminPassword: 'test',
  };
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    require: (name) => name === 'pocketbase/cjs' ? PocketBase : { config },
    console: { log() {} },
    URL,
  });

  const { pbAdmin } = module.exports;
  const calls = [];
  const send = async (url, options) => {
    calls.push([url, options.headers.Authorization, options.method, options.body]);
    if (url.endsWith('/denied')) return globalThis.Response.json({ message: 'Запрещено' }, { status: 403 });
    return options.headers.Authorization === 'старый'
      ? globalThis.Response.json({ message: 'Only superusers can perform this action.' }, { status: 403 })
      : globalThis.Response.json({ success: true });
  };
  const prepare = (route, method, body) => pbAdmin.beforeSend('http://127.0.0.1:8090/' + route, {
    headers: {}, method, body, fetch: send,
  });
  const requests = await Promise.all([prepare('bookings', 'GET'), prepare('settings', 'PATCH', '{}')]);
  const responses = await Promise.all(requests.map(({ url, options }) => options.fetch(url, options)));
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(loginCount, 1);
  assert.deepEqual(calls.filter(([url]) => url.endsWith('/settings')).map(([, token, method, body]) => [token, method, body]), [
    ['старый', 'PATCH', '{}'],
    ['новый', 'PATCH', '{}'],
  ]);

  const denied = await prepare('denied', 'POST');
  assert.equal((await denied.options.fetch(denied.url, denied.options)).status, 403);
  assert.equal(calls.filter(([url]) => url.endsWith('/denied')).length, 1);
  assert.equal(loginCount, 1);
});
