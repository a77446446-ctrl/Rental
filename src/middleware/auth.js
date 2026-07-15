const { config } = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const sessionService = require('../services/adminSession.service');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function auditMutation(req, res) {
  if (SAFE_METHODS.has(req.method) || !supabaseAdmin) return;
  res.once('finish', () => {
    const details = {
      params: req.params || {},
      body_keys: req.body && typeof req.body === 'object'
        ? Object.keys(req.body).filter((key) => !/password|token|secret/i.test(key))
        : [],
    };
    supabaseAdmin.from('admin_audit_log').insert({
      actor: req.adminUser || config.adminUsername,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      ip: req.ip,
      user_agent: String(req.get('user-agent') || '').slice(0, 500),
      details,
    }).then(({ error }) => {
      if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
        console.error('[audit] Не удалось записать действие:', error.message);
      }
    });
  });
}

function unauthorized(req, res) {
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }
  return res.redirect('/admin/login');
}

function requireAdmin(req, res, next) {
  let session = sessionService.parseSession(req.signedCookies.eco_admin_session);
  if (!session) return unauthorized(req, res);

  // Бесшовно обновляем старые подписанные cookie после развертывания.
  if (session.legacy) session = sessionService.setSessionCookies(res);

  if (!SAFE_METHODS.has(req.method)) {
    if (!sessionService.safeEqual(session.csrf, req.cookies.eco_admin_csrf) ||
        !sessionService.safeEqual(session.csrf, req.get('x-csrf-token'))) {
      return res.status(403).json({
        success: false,
        error: 'Сессия устарела. Обновите страницу и повторите действие.',
      });
    }
  }

  req.adminUser = session.user;
  auditMutation(req, res);
  return next();
}

module.exports = { requireAdmin };
