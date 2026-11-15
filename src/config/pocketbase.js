/**
 * Клиент PocketBase для серверного использования.
 * Заменяет SupabaseAdmin.
 */

const PocketBase = require('pocketbase/cjs');
const { config } = require('./env');

const pb = new PocketBase(config.pocketbaseUrl);

// Сервер обрабатывает параллельные запросы разных пользователей; их нельзя взаимно отменять.
if (typeof pb.autoCancellation === 'function') pb.autoCancellation(false);

let authPromise = null;

// Auto-authenticate as admin for backend operations
async function initPocketBase() {
  if (!config.pocketbaseAdminEmail || !config.pocketbaseAdminPassword) {
    console.warn('[PocketBase] ВНИМАНИЕ: Не заданы POCKETBASE_ADMIN_EMAIL или POCKETBASE_ADMIN_PASSWORD');
    return false;
  }

  try {
    try {
      await pb.collection('_superusers').authWithPassword(config.pocketbaseAdminEmail, config.pocketbaseAdminPassword);
    } catch {
      await pb.admins.authWithPassword(config.pocketbaseAdminEmail, config.pocketbaseAdminPassword);
    }
    const target = new URL(config.pocketbaseUrl);
    console.log('[PocketBase] Успешная авторизация администратора: ' + target.origin + target.pathname.replace(/\/$/, ''));
    return true;
  } catch (err) {
    console.error('[PocketBase] Ошибка авторизации:', err.message);
    return false;
  }
}

async function ensureAdminAuth() {
  if (pb.authStore && pb.authStore.isValid) {
    return true;
  }
  if (!authPromise) {
    authPromise = initPocketBase().finally(() => {
      authPromise = null;
    });
  }
  return authPromise;
}

// Автоматический перехватчик: перед отправкой любого запроса гарантируем наличие валидного токена суперпользователя
pb.beforeSend = async (url, options) => {
  // Не перехватываем сам запрос авторизации, чтобы избежать зацикливания
  if (!url.includes('/auth-with-password')) {
    if (!pb.authStore || !pb.authStore.isValid) {
      await ensureAdminAuth();
    }
    if (pb.authStore && pb.authStore.token && options && options.headers) {
      options.headers['Authorization'] = pb.authStore.token;
    }
  }
  return { url, options };
};

// Пробуем авторизоваться при старте модуля (если PocketBase уже запущен)
initPocketBase().catch(() => {});

// Export as pbAdmin to replace supabaseAdmin in legacy code
module.exports = { pbAdmin: pb, pb, initPocketBase, ensureAdminAuth };
