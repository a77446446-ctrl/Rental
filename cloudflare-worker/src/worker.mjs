const MAX_BODY_BYTES = 64 * 1024;
const TELEGRAM_TIMEOUT_MS = 15000;

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function secretsMatch(actual, expected) {
  const actualText = String(actual || '');
  const expectedText = String(expected || '');
  if (expectedText.length < 32 || actualText.length !== expectedText.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expectedText.length; i += 1) {
    mismatch |= actualText.charCodeAt(i) ^ expectedText.charCodeAt(i);
  }
  return mismatch === 0;
}

async function readTelegramPayload(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
  }

  try {
    return JSON.parse(body || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 });
  }
}

function validateMessage(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (!['string', 'number'].includes(typeof payload.chat_id)) return false;
  return typeof payload.text === 'string' && payload.text.trim().length > 0 && payload.text.length <= 4096;
}

export async function handleRequest(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    return jsonResponse(200, { success: true });
  }

  if (request.method !== 'POST' || url.pathname !== '/telegram/sendMessage') {
    return jsonResponse(404, { success: false, error: 'Not found' });
  }

  const botToken = env && env.TELEGRAM_BOT_TOKEN;
  const relaySecret = env && env.TELEGRAM_RELAY_SECRET;
  if (!botToken || !relaySecret) {
    return jsonResponse(503, { success: false, error: 'Relay is not configured' });
  }

  if (!secretsMatch(request.headers.get('x-telegram-relay-secret'), relaySecret)) {
    return jsonResponse(401, { success: false, error: 'Unauthorized' });
  }

  try {
    const payload = await readTelegramPayload(request);
    if (!validateMessage(payload)) {
      return jsonResponse(400, { success: false, error: 'Invalid Telegram message' });
    }

    const telegramResponse = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
        : undefined,
    });
    const telegramBody = await telegramResponse.text();

    if (!telegramResponse.ok) {
      console.error(`[cloudflare-relay] Telegram returned HTTP ${telegramResponse.status}`);
      return jsonResponse(502, { success: false, error: 'Telegram rejected the message' });
    }

    let telegramData = null;
    try { telegramData = JSON.parse(telegramBody); } catch { /* Telegram returned non-JSON */ }
    if (telegramData && telegramData.ok === false) {
      console.error('[cloudflare-relay] Telegram returned ok=false');
      return jsonResponse(502, { success: false, error: 'Telegram rejected the message' });
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error('[cloudflare-relay] Delivery failed:', error.message);
    return jsonResponse(error.statusCode || 502, { success: false, error: 'Delivery failed' });
  }
}

export { secretsMatch };

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
