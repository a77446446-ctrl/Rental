const crypto = require('crypto');
const { config } = require('../../config/env');
const sessionService = require('../../services/adminSession.service');

function credentialMatches(actual, expected) {
  const a = Buffer.from(String(actual || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.login = (req, res) => {
  const { username, password } = req.body || {};
  if (credentialMatches(username, config.adminUsername) && credentialMatches(password, config.adminPassword)) {
    sessionService.setSessionCookies(res);
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
};

exports.logout = (_req, res) => {
  sessionService.clearSessionCookies(res);
  res.json({ success: true });
};

exports.me = (req, res) => {
  res.json({ success: true, user: req.adminUser || config.adminUsername });
};
