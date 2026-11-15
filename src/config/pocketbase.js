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

pb.beforeSend = async (url, options) => {
  if (url.endsWith('/auth-with-password')) return { url, options };

  const token = await ensureAdminAuth() ? pb.authStore.token : '';
  if (!token) {
    delete options.headers.Authorization;
    return { url, options };
  }
  options.headers.Authorization = token;

  const send = options.fetch || fetch;
  options.fetch = async (requestUrl, requestOptions) => {
    const response = await send(requestUrl, requestOptions);
    if (response.status !== 403) return response;

    const error = await response.clone().json().catch(() => null);
    // PocketBase отклоняет такой запрос до чтения или записи данных.
    if (error?.message !== 'Only superusers can perform this action.') return response;

    if (pb.authStore.token === token) pb.authStore.clear();
    if (!await ensureAdminAuth()) return response;

    return send(requestUrl, {
      ...requestOptions,
      headers: { ...requestOptions.headers, Authorization: pb.authStore.token },
    });
  };

  return { url, options };
};

module.exports = { pbAdmin: pb, pb, initPocketBase, ensureAdminAuth };
