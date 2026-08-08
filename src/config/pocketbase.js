/**
 * Клиент PocketBase для серверного использования.
 * Заменяет SupabaseAdmin.
 */

const PocketBase = require('pocketbase/cjs');
const { config } = require('./env');

const pb = new PocketBase(config.pocketbaseUrl);

// Auto-authenticate as admin for backend operations
async function initPocketBase() {
  try {
    if (config.pocketbaseAdminEmail && config.pocketbaseAdminPassword) {
      await pb.admins.authWithPassword(config.pocketbaseAdminEmail, config.pocketbaseAdminPassword);
      console.log('[PocketBase] Успешная авторизация администратора');
    } else {
      console.warn('[PocketBase] ВНИМАНИЕ: Не заданы POCKETBASE_ADMIN_EMAIL или POCKETBASE_ADMIN_PASSWORD');
    }
  } catch (err) {
    console.error('[PocketBase] Ошибка авторизации:', err.message);
  }
}

initPocketBase();

// Export as pbAdmin to replace supabaseAdmin in legacy code
module.exports = { pbAdmin: pb, pb, initPocketBase };
