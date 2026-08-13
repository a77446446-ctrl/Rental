const test = require('node:test');
const assert = require('node:assert/strict');
const { config } = require('../src/config/env');
const maxService = require('../src/services/max.service');

test('MAX service validates secret and handles webhook replies', async () => {
  const previousSecret = config.maxWebhookSecret;
  const previousToken = config.maxBotToken;
  const previousChatId = config.maxChatId;
  const previousFetch = global.fetch;

  config.maxWebhookSecret = 'test-max-secret-key-12345';
  config.maxBotToken = 'test-token';
  config.maxChatId = '123456';

  try {
    assert.equal(maxService.isValidMaxWebhook('test-max-secret-key-12345'), true);
    assert.equal(maxService.isValidMaxWebhook('wrong-key'), false);

    const savedMessages = [];
    const mockPayload = {
      update_id: 101,
      message: {
        text: 'Привет от администратора',
        reply_to_message: {
          text: 'Сообщение из чата #token:11111111-2222-3333-4444-555555555555'
        }
      }
    };

    await maxService.handleMaxWebhook(mockPayload, async (token, text, sender) => {
      savedMessages.push({ token, text, sender });
    });

    assert.equal(savedMessages.length, 1);
    assert.equal(savedMessages[0].token, '11111111-2222-3333-4444-555555555555');
    assert.equal(savedMessages[0].text, 'Привет от администратора');
    assert.equal(savedMessages[0].sender, 'admin');
  } finally {
    config.maxWebhookSecret = previousSecret;
    config.maxBotToken = previousToken;
    config.maxChatId = previousChatId;
    global.fetch = previousFetch;
  }
});

test('MAX передаёт ответы администратора с фото и видео обратно на сайт', async () => {
  const savedMessages = [];
  const chatToken = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const cases = [
    { updateId: 201, type: 'image', url: 'https://storage.supabase.co/storage/v1/object/public/chat/photo.jpg' },
    { updateId: 202, type: 'video', url: 'https://storage.supabase.co/storage/v1/object/public/chat/video.mp4' },
  ];

  for (const item of cases) {
    await maxService.handleMaxWebhook({
      update_id: item.updateId,
      message: {
        attachments: [{ type: item.type, payload: { url: item.url } }],
        reply_to_message: { text: `Сообщение из чата #token:${chatToken}` },
      },
    }, async (token, text, sender) => {
      savedMessages.push({ token, text, sender });
    });
  }

  assert.equal(savedMessages.length, 2);
  assert.deepEqual(savedMessages.map((message) => JSON.parse(message.text).mediaType), ['image', 'video']);
  assert.equal(savedMessages.every((message) => message.token === chatToken), true);
  assert.equal(savedMessages.every((message) => message.sender === 'admin'), true);
});

test('MAX переключается на рабочий API-домен и параметр user_id', async () => {
  const previousUrl = config.maxApiUrl;
  const previousToken = config.maxBotToken;
  const previousChatId = config.maxChatId;
  const previousFetch = global.fetch;
  const calls = [];

  config.maxApiUrl = 'https://platform-api2.max.ru';
  config.maxBotToken = 'test-token';
  config.maxChatId = '25383544';

  global.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, body: options.body || null });

    if (target.startsWith('https://platform-api2.max.ru')) {
      const error = new TypeError('fetch failed');
      error.cause = { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' };
      throw error;
    }

    if (target.includes('chat_id=')) {
      return {
        ok: false,
        status: 404,
        text: async () => '{"code":"chat.not.found"}',
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () => '{"message":{"body":{"mid":"test"}}}',
    };
  };

  try {
    const delivered = await maxService.callMaxApi('sendMessage', {
      chat_id: config.maxChatId,
      text: 'Проверка',
    });

    assert.equal(delivered, true);
    assert.equal(calls.some((call) => call.url.startsWith('https://platform-api2.max.ru')), true);
    assert.equal(calls.some((call) => call.url.startsWith('https://platform-api.max.ru') && call.url.includes('chat_id=')), true);
    assert.equal(calls.some((call) => call.url.startsWith('https://platform-api.max.ru') && call.url.includes('user_id=')), true);

    const attachmentDelivered = await maxService.notifyAdminAttachment(
      '11111111-2222-3333-4444-555555555555',
      { mediaType: 'video', url: 'https://eco-gorniy.ru/api/chat/media/test-video.mp4' },
      'Автотест'
    );
    const sentPayloads = calls
      .map((call) => call.body ? JSON.parse(call.body) : null)
      .filter(Boolean);

    assert.equal(attachmentDelivered, true);
    assert.equal(sentPayloads.some((payload) => payload.attachments?.[0]?.type === 'file'), true);
    assert.equal(sentPayloads.some((payload) => payload.attachments?.[0]?.payload?.url.includes('test-video.mp4')), true);
  } finally {
    config.maxApiUrl = previousUrl;
    config.maxBotToken = previousToken;
    config.maxChatId = previousChatId;
    global.fetch = previousFetch;
  }
});
