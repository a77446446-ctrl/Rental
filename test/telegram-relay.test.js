const test = require('node:test');
const assert = require('node:assert/strict');
const { config } = require('../src/config/env');
const { sendBookingNotification } = require('../src/services/telegram.service');

async function callWorker(request, fetchImpl) {
  const worker = await import('../cloudflare-worker/src/worker.mjs');
  return worker.handleRequest(request, {
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    TELEGRAM_RELAY_SECRET: 'a'.repeat(32),
  }, fetchImpl);
}

test('Cloudflare Telegram relay rejects requests without its shared secret', async () => {
  let forwarded = false;
  const response = await callWorker(new Request('https://relay.example.test/telegram/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: '1', text: 'Booking' }),
  }), async () => {
    forwarded = true;
    return new globalThis.Response('{"ok":true}', { status: 200 });
  });
  assert.equal(response.status, 401);
  assert.equal(forwarded, false);
});

test('Cloudflare Telegram relay forwards an authorized booking notification', async () => {
  let forwardedUrl = '';
  let forwardedPayload = null;
  const response = await callWorker(new Request('https://relay.example.test/telegram/sendMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Relay-Secret': 'a'.repeat(32),
    },
    body: JSON.stringify({ chat_id: '42', text: 'New booking' }),
  }), async (url, options) => {
    forwardedUrl = url;
    forwardedPayload = JSON.parse(options.body);
    return new globalThis.Response('{"ok":true,"result":{}}', { status: 200 });
  });
  assert.equal(response.status, 200);
  assert.match(forwardedUrl, /api\.telegram\.org\/bottest-bot-token\/sendMessage$/);
  assert.deepEqual(forwardedPayload, { chat_id: '42', text: 'New booking' });
});

test('booking notifications use the configured Cloudflare relay', async () => {
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
