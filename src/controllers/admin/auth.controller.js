const { config } = require('../../config/env');

exports.login = (req, res) => {
  const { username, password } = req.body;
  if (username === config.adminUsername && password === config.adminPassword) {
    res.cookie('eco_admin_session', 'authenticated', {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      signed: true,
      maxAge: config.sessionTtlHours * 60 * 60 * 1000,
      sameSite: 'lax',
    });
    return res.json({ success: true });
  }
  return res.status(401).json({
    success: false,
    error: 'Неверный логин или пароль',
  });
};

exports.logout = (req, res) => {
  res.clearCookie('eco_admin_session', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    signed: true,
    sameSite: 'lax',
  });
  res.json({ success: true });
};

exports.me = (req, res) => {
  res.json({ success: true, user: config.adminUsername });
};
