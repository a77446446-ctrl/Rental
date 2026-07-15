const crypto = require('crypto');
const { config } = require('../config/env');

function cookieBase() {
  return { secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/' };
}

function createPayload() {
  const now = Date.now();
  return {
    v: 2,
    user: config.adminUsername,
    iat: now,
    exp: now + config.sessionTtlHours * 60 * 60 * 1000,
    nonce: crypto.randomBytes(18).toString('base64url'),
    csrf: crypto.randomBytes(24).toString('base64url'),
  };
}

function setSessionCookies(res, payload = createPayload()) {
  const maxAge = Math.max(0, payload.exp - Date.now());
  res.cookie('eco_admin_session', JSON.stringify(payload), {
    ...cookieBase(), httpOnly: true, signed: true, maxAge,
  });
  res.cookie('eco_admin_csrf', payload.csrf, {
    ...cookieBase(), httpOnly: false, signed: false, maxAge,
  });
  return payload;
}

function clearSessionCookies(res) {
  res.clearCookie('eco_admin_session', { ...cookieBase(), httpOnly: true, signed: true });
  res.clearCookie('eco_admin_csrf', { ...cookieBase(), httpOnly: false, signed: false });
}

function parseSession(value) {
  if (!value) return null;
  if (value === 'authenticated') return { legacy: true };
  try {
    const payload = JSON.parse(value);
    if (payload.v !== 2 || payload.user !== config.adminUsername || !payload.csrf || !payload.exp) return null;
    return Date.now() < Number(payload.exp) ? payload : null;
  } catch (_err) {
    return null;
  }
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a || ''));
  const second = Buffer.from(String(b || ''));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

module.exports = { setSessionCookies, clearSessionCookies, parseSession, safeEqual };
