const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createRelayServer } = require('../telegram-relay/server');
const { config } = require('../src/config/env');
const { sendBookingNotification } = require('../src/services/telegram.service');

async function withRelay(fetchImpl, callback) {
  const server = createRelayServer({
    botToken: 'test-bot-token',
    relaySecret: 'a'.repeat(32),
    fetchImpl,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('Telegram relay rejects requests without its shared secret', async () => {
  let forwarded = false;
  await withRelay(async () => {
    forwarded = true;
    return new globalThis.Response('{"ok":true}', { status: 200 });
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/telegram/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: '1', text: 'Booking' }),
    });
    assert.equal(response.status, 401);
    assert.equal(forwarded, false);
  });
});

test('Telegram relay forwards an authorized booking notification', async () => {
  let forwardedUrl = '';
  let forwardedPayload = null;
  await withRelay(async (url, options) => {
    forwardedUrl = url;
    forwardedPayload = JSON.parse(options.body);
    return new globalThis.Response('{"ok":true,"result":{}}', { status: 200 });
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/telegram/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Relay-Secret': 'a'.repeat(32),
      },
      body: JSON.stringify({ chat_id: '42', text: 'New booking' }),
    });
    assert.equal(response.status, 200);
    assert.match(forwardedUrl, /api\.telegram\.org\/bottest-bot-token\/sendMessage$/);
    assert.deepEqual(forwardedPayload, { chat_id: '42', text: 'New booking' });
  });
});

test('booking notifications use the configured Railway relay', async () => {
  const previous = {
    relayUrl: config.telegramRelayUrl,
    relaySecret: config.telegramRelaySecret,
    chatId: config.telegramChatId,
    fetch: global.fetch,
  };
  const calls = [];
  config.telegramRelayUrl = 'https://relay.example.test';
  config.telegramRelaySecret = 'b'.repeat(32);
  config.telegramChatId = '42';
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new globalThis.Response('{"success":true}', { status: 200 });
  };

  try {
    const delivered = await sendBookingNotification({
      id: 'booking-id',
      cabinName: 'Дом-А',
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      nightsCount: 2,
      totalPrice: 16000,
      guestName: 'Тест',
      guestPhone: '+70000000000',
      guestTelegram: '',
    });
    assert.equal(delivered, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://relay.example.test/telegram/sendMessage');
    assert.equal(calls[0].options.headers['X-Telegram-Relay-Secret'], 'b'.repeat(32));
  } finally {
    config.telegramRelayUrl = previous.relayUrl;
    config.telegramRelaySecret = previous.relaySecret;
    config.telegramChatId = previous.chatId;
    global.fetch = previous.fetch;
  }
});
