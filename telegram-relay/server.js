const http = require('node:http');
const crypto = require('node:crypto');

const MAX_BODY_BYTES = 64 * 1024;
const TELEGRAM_TIMEOUT_MS = 15000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function secretsMatch(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''));
  const expectedBuffer = Buffer.from(String(expected || ''));
  return actualBuffer.length === expectedBuffer.length
    && expectedBuffer.length >= 32
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks = [];

    request.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function validateMessage(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (!['string', 'number'].includes(typeof payload.chat_id)) return false;
  return typeof payload.text === 'string' && payload.text.trim().length > 0 && payload.text.length <= 4096;
}

function createRelayServer(options = {}) {
  const botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
  const relaySecret = options.relaySecret || process.env.TELEGRAM_RELAY_SECRET || '';
  const fetchImpl = options.fetchImpl || fetch;

  return http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      return sendJson(response, 200, { success: true });
    }

    if (request.method !== 'POST' || request.url !== '/telegram/sendMessage') {
      return sendJson(response, 404, { success: false, error: 'Not found' });
    }

    if (!botToken || !relaySecret) {
      return sendJson(response, 503, { success: false, error: 'Relay is not configured' });
    }

    if (!secretsMatch(request.headers['x-telegram-relay-secret'], relaySecret)) {
      return sendJson(response, 401, { success: false, error: 'Unauthorized' });
    }

    try {
      const payload = await readJson(request);
      if (!validateMessage(payload)) {
        return sendJson(response, 400, { success: false, error: 'Invalid Telegram message' });
      }

      const telegramResponse = await fetchImpl(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: typeof globalThis.AbortSignal?.timeout === 'function'
            ? globalThis.AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
            : undefined,
        }
      );
      const telegramBody = await telegramResponse.text();

      if (!telegramResponse.ok) {
        console.error(`[relay] Telegram returned HTTP ${telegramResponse.status}`);
        return sendJson(response, 502, { success: false, error: 'Telegram rejected the message' });
      }

      let telegramData = null;
      try { telegramData = JSON.parse(telegramBody); } catch { /* Telegram returned non-JSON */ }
      if (telegramData && telegramData.ok === false) {
        console.error('[relay] Telegram returned ok=false');
        return sendJson(response, 502, { success: false, error: 'Telegram rejected the message' });
      }

      return sendJson(response, 200, { success: true });
    } catch (error) {
      console.error('[relay] Delivery failed:', error.message);
      return sendJson(response, error.statusCode || 502, { success: false, error: 'Delivery failed' });
    }
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT, 10) || 3000;
  const server = createRelayServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`[relay] Listening on 0.0.0.0:${port}`);
  });
}

module.exports = { createRelayServer, secretsMatch };
