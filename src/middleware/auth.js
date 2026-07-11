const { config } = require('../config/env');

/**
 * Middleware для защиты админ-роутов и API.
 * Проверяет наличие подписанной куки.
 */
function requireAdmin(req, res, next) {
  const token = req.signedCookies.eco_admin_session;

  if (token === 'authenticated') {
    return next();
  }

  // Если это запрос к API (например, /api/admin/...)
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({
      success: false,
      error: 'Требуется авторизация',
    });
  }

  // Если это запрос страницы (например, /admin/dashboard)
  res.redirect('/admin/login');
}

module.exports = {
  requireAdmin,
};
