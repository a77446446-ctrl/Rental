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
