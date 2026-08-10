const { config } = require('../config/env');
const sessionService = require('../services/adminSession.service');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function auditMutation(req, _res) {
  // Supabase audit logging was retired with the database migration.
  if (SAFE_METHODS.has(req.method)) return;
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
